#!/usr/bin/env node
// Minimal Supabase emulator for LOCAL TESTING ONLY (no real project is touched).
//   node scripts/mock-supabase.mjs [port]     default port 54321
// Covers just what this app uses: PostgREST filters/embeds/order/range/count, /auth/v1/user, Storage upload + public GET.
// Test controls:  POST /__ctl {"mode":"ok"|"503"|"hang","delayMs":0}   GET /__stats   POST /__stats/reset   GET /__db/<table>   GET /__storage
import http from 'node:http';

const PORT = Number(process.argv[2] || process.env.PORT || 54321);
const uuid = (n, p = 4) => `00000000-0000-4000-8000-${String(p).padStart(4, '0')}${String(n).padStart(8, '0')}`;
const iso = (i) => new Date(Date.UTC(2026, 10, 1) + i * 3_600_000).toISOString();

// ---------------- fixtures ----------------
const db = {
  categories: [
    { id: uuid(1, 1), name: 'Fashion', slug: 'fashion', parent_id: null, sort_order: 1, image_url: null },
    { id: uuid(2, 1), name: 'Electronics', slug: 'electronics', parent_id: null, sort_order: 2, image_url: null },
    { id: uuid(3, 1), name: 'Men', slug: 'fashion-men', parent_id: uuid(1, 1), sort_order: 1, image_url: null },
  ],
  retailers: [{ id: uuid(1, 2), name: 'Amazon' }, { id: uuid(2, 2), name: 'Flipkart' }],
  brands: [{ id: uuid(1, 3), name: 'Acme', slug: 'acme' }],
  products: [], product_images: [], product_affiliate_links: [], affiliate_clicks: [], saved_items: [],
  website_settings: [], contact_messages: [], subscribers: [],
  admin_profiles: [{ user_id: 'user-admin', role: 'admin' }],
};
// 30 published products (pagination: 24 per page) + 1 draft
for (let i = 1; i <= 31; i++) {
  const price = 500 + i * 100, orig = i % 3 === 0 ? price + 300 : null;
  db.products.push({
    id: uuid(i, 4), name: `Test Product ${i}`, slug: `product-${i}`, brand_id: i % 2 ? uuid(1, 3) : null,
    category_id: i % 2 ? uuid(3, 1) : uuid(2, 1), short_description: `Short text ${i}`, description: `Long description ${i}`,
    specifications: { Colour: 'Black' }, main_image_url: null, price, original_price: orig, currency: 'INR',
    status: i === 31 ? 'draft' : 'published', featured: i <= 2, trending: i === 3,
    discount_pct: orig ? Math.round((1 - price / orig) * 100) : null, created_at: iso(i), updated_at: iso(i), price_checked_at: iso(i),
    seo_title: null, seo_description: null,
  });
  db.product_affiliate_links.push({ id: uuid(i, 5), product_id: uuid(i, 4), retailer_id: i % 2 ? uuid(1, 2) : uuid(2, 2),
    affiliate_url: i % 2 ? `https://www.amazon.in/dp/B0${i}?tag=studio-21&utm_source=ss` : `https://www.flipkart.com/p/item${i}?affid=ss`,
    display_price: null, priority: 0 });
}
// link 28 deliberately points at a host that is NOT an approved merchant (used by the open-redirect tests)
db.product_affiliate_links[27].affiliate_url = 'https://evil.example.org/phish?x=1';
db.saved_items.push({ user_id: 'user-1', product_id: uuid(1, 4), created_at: iso(1) });

const REL = { // table -> embed name -> { table, fk, many }
  products: { categories: { t: 'categories', local: 'category_id', many: false }, brands: { t: 'brands', local: 'brand_id', many: false },
    product_images: { t: 'product_images', remote: 'product_id', many: true }, product_affiliate_links: { t: 'product_affiliate_links', remote: 'product_id', many: true } },
  product_affiliate_links: { retailers: { t: 'retailers', local: 'retailer_id', many: false }, products: { t: 'products', local: 'product_id', many: false } },
  saved_items: { products: { t: 'products', local: 'product_id', many: false } },
};
const UNIQUE = { products: ['slug'], categories: ['slug'], brands: ['name', 'slug'], retailers: ['name'], subscribers: ['email'] };

// ---------------- state ----------------
let mode = 'ok';
let delayMs = 0; // added latency (ms) on every REST/auth/storage response
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { rest: {}, auth: 0, storage: 0, total: 0 };
const bump = (k) => { stats.rest[k] = (stats.rest[k] || 0) + 1; stats.total++; };
const storage = new Map(); // "bucket/path" -> { buf, type, cache }

// ---------------- helpers ----------------
const splitTop = (s) => { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; };
function parseSelect(sel) {
  return splitTop(sel || '*').map((tok) => {
    const m = tok.match(/^(?:(\w+):)?(\w+)(!inner)?(?:\((.*)\))?$/s);
    if (!m) return { col: tok };
    if (m[4] === undefined) return { col: m[2] };
    return { embed: m[2], inner: !!m[3], sel: parseSelect(m[4]) };
  });
}
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function test(row, col, op, val) {
  const v = row[col];
  switch (op) {
    case 'eq': return String(v) === val;
    case 'neq': return String(v) !== val;
    case 'gt': return v != null && Number(v) > Number(val);
    case 'gte': return v != null && Number(v) >= Number(val);
    case 'lt': return v != null && Number(v) < Number(val);
    case 'lte': return v != null && Number(v) <= Number(val);
    case 'is': return val === 'null' ? v == null : String(v) === val;
    case 'in': return splitTop(val.replace(/^\(|\)$/g, '')).map((x) => x.replace(/^"|"$/g, '')).includes(String(v));
    case 'ilike': case 'like': { const re = new RegExp('^' + val.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/\*/g, '.*') + '$', op === 'ilike' ? 'i' : ''); return v != null && re.test(String(v)); }
    default: return true;
  }
}
const parseCond = (c) => { const i = c.indexOf('.'), j = c.indexOf('.', i + 1); return [c.slice(0, i), c.slice(i + 1, j), c.slice(j + 1)]; };

function runSelect(table, params, sel) {
  let rows = db[table].slice();
  const embedFilters = {};
  for (const [k, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    if (k === 'or') { const conds = splitTop(raw.replace(/^\(|\)$/g, '')).map(parseCond); rows = rows.filter((r) => conds.some(([c, o, v]) => test(r, c, o, v))); continue; }
    if (k.includes('.')) { const [rel, col] = k.split('.'); (embedFilters[rel] ||= []).push([col, ...raw.split(/\.(.+)/).slice(0, 2)]); continue; }
    const [op, ...rest] = raw.split('.'); rows = rows.filter((r) => test(r, k, op, rest.join('.')));
  }
  const parsed = parseSelect(sel);
  const withEmbeds = rows.map((r) => ({ r, out: shape(table, r, parsed, embedFilters) }));
  let kept = withEmbeds.filter(({ out }, i) => parsed.every((p) => !p.inner || (Array.isArray(out[p.embed]) ? out[p.embed].length : out[p.embed])));
  const order = params.get('order');
  if (order) {
    const keys = order.split(',').map((o) => { const [c, d, n] = o.split('.'); return { c, desc: d === 'desc', nullsFirst: n === 'nullsfirst' ? true : n === 'nullslast' ? false : d === 'desc' }; });
    kept.sort((a, b) => { for (const { c, desc, nullsFirst } of keys) { const x = a.r[c], y = b.r[c]; if (x == null || y == null) { if (x == y) continue; return (x == null) === nullsFirst ? -1 : 1; } const k = cmp(x, y); if (k) return desc ? -k : k; } return 0; });
  }
  return kept.map((k) => k.out);
}
function shape(table, row, parsed, embedFilters) {
  const out = {};
  for (const p of parsed) {
    if (p.col === '*') Object.assign(out, row);
    else if (p.col) out[p.col] = row[p.col];
    else {
      const rel = REL[table]?.[p.embed]; if (!rel) continue;
      let related = db[rel.t].filter((x) => (rel.local ? x.id === row[rel.local] : x[rel.remote] === row.id));
      for (const [c, o, v] of embedFilters[p.embed] || []) related = related.filter((x) => test(x, c, o, v));
      const shaped = related.map((x) => shape(rel.t, x, p.sel, {}));
      out[p.embed] = rel.many ? shaped : shaped[0] ?? null;
    }
  }
  return out;
}

const readBody = (req) => new Promise((res) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => res(Buffer.concat(c))); });
const send = (res, code, body, headers = {}) => { const s = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body); res.writeHead(code, { 'content-type': 'application/json', ...headers }); res.end(s); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  try {
    // ---- test controls (never affected by failure mode) ----
    if (p === '/__ctl') { const b = JSON.parse((await readBody(req)).toString() || '{}'); mode = b.mode || 'ok'; delayMs = Number(b.delayMs || 0); return send(res, 200, { mode, delayMs }); }
    if (p === '/__stats/reset') { stats.rest = {}; stats.auth = 0; stats.storage = 0; stats.total = 0; return send(res, 200, { ok: true }); }
    if (p === '/__stats') return send(res, 200, stats);
    if (p.startsWith('/__db/')) return send(res, 200, db[p.slice(6)] ?? []);
    if (p === '/__storage') return send(res, 200, [...storage].map(([k, v]) => ({ key: k, bytes: v.buf.length, type: v.type, cache: v.cache })));
    if (p === '/__seed' && req.method === 'POST') { const b = JSON.parse((await readBody(req)).toString()); for (const [t, rows] of Object.entries(b)) db[t] = rows; return send(res, 200, { ok: true }); }

    // ---- failure injection ----
    if (delayMs) await sleep(delayMs);
    if (mode === 'hang') return; // never answer: exercises client timeouts
    if (mode === '503') { stats.total++; return send(res, 503, { message: 'mock outage' }); }

    // ---- auth ----
    if (p === '/auth/v1/user') {
      stats.auth++; stats.total++;
      const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
      if (tok === 'good-token') return send(res, 200, { id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'shopper@example.com', app_metadata: {}, user_metadata: {}, created_at: iso(0) });
      if (tok === 'admin-token') return send(res, 200, { id: 'user-admin', aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: {}, created_at: iso(0) });
      return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    }

    // ---- storage ----
    if (p.startsWith('/storage/v1/object/public/')) {
      const e = storage.get(decodeURIComponent(p.slice('/storage/v1/object/public/'.length)));
      if (!e) return send(res, 404, { message: 'not found' });
      return send(res, 200, e.buf, { 'content-type': e.type, 'cache-control': e.cache || 'no-cache' });
    }
    if (p.startsWith('/storage/v1/object/') && !p.startsWith('/storage/v1/object/list/') && req.method === 'GET') { // authenticated download
      const e = storage.get(decodeURIComponent(p.slice('/storage/v1/object/'.length)));
      return e ? send(res, 200, e.buf, { 'content-type': e.type }) : send(res, 404, { message: 'not found' });
    }
    if (p.startsWith('/storage/v1/object/list/') && req.method === 'POST') { // storage-js list(): one folder level
      const b = JSON.parse((await readBody(req)).toString() || '{}'); const bucket = decodeURIComponent(p.slice('/storage/v1/object/list/'.length));
      const prefix = b.prefix ? `${b.prefix.replace(/\/$/, '')}/` : ''; const seen = new Map();
      for (const [k, v] of storage) { if (!k.startsWith(`${bucket}/${prefix}`)) continue; const rest = k.slice(bucket.length + 1 + prefix.length); const [first, ...more] = rest.split('/');
        seen.set(first, more.length ? { name: first, id: null } : { name: first, id: k, metadata: { size: v.buf.length, mimetype: v.type } }); }
      return send(res, 200, [...seen.values()].slice(b.offset || 0, (b.offset || 0) + (b.limit || 100)));
    }
    if (p.startsWith('/storage/v1/object/') && req.method === 'POST') {
      stats.storage++; stats.total++;
      const key = decodeURIComponent(p.slice('/storage/v1/object/'.length));
      const buf = await readBody(req);
      storage.set(key, { buf, type: req.headers['content-type'] || 'application/octet-stream', cache: req.headers['cache-control'] || '' });
      return send(res, 200, { Key: key, Id: key });
    }

    // ---- PostgREST ----
    const m = p.match(/^\/rest\/v1\/(\w+)(?:\/(\w+))?$/);
    if (m) {
      const table = m[1];
      if (table === 'rpc') { bump(`rpc:${m[2]}`); return send(res, 200, []); }
      if (!db[table]) return send(res, 404, { code: 'PGRST205', message: `no table ${table}` });
      bump(table);
      const prefer = req.headers.prefer || '';
      const wantObj = /pgrst\.object/.test(req.headers.accept || '');
      if (req.method === 'GET' || req.method === 'HEAD') {
        let rows = runSelect(table, url.searchParams, url.searchParams.get('select'));
        if (table === 'admin_profiles') { // emulate the real RLS policy "self read": using (user_id = auth.uid())
          const uid = { 'good-token': 'user-1', 'admin-token': 'user-admin' }[(req.headers.authorization || '').replace(/^Bearer /, '')];
          rows = db.admin_profiles.some((r) => r.user_id === uid) ? rows.slice(0, 1) : [];
        }
        const total = rows.length, offset = Number(url.searchParams.get('offset') || 0), limit = url.searchParams.get('limit');
        rows = rows.slice(offset, limit ? offset + Number(limit) : undefined);
        const hdr = {}; if (/count=/.test(prefer)) hdr['content-range'] = `${rows.length ? `${offset}-${offset + rows.length - 1}` : '*'}/${total}`;
        if (req.method === 'HEAD') return send(res, 200, '', hdr);
        if (wantObj) return rows.length === 1 ? send(res, 200, rows[0]) : send(res, 406, { code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
        return send(res, 200, rows, hdr);
      }
      if (req.method === 'POST') {
        const raw = JSON.parse((await readBody(req)).toString() || '[]'); const items = Array.isArray(raw) ? raw : [raw];
        const upsert = /merge-duplicates/.test(prefer); const out = [];
        for (const it of items) {
          const row = { id: it.id ?? uuid(db[table].length + 100 + Math.floor(Math.random() * 1e6), 9), created_at: new Date().toISOString(), ...it };
          const dup = (UNIQUE[table] || []).find((c) => db[table].some((x) => x[c] === row[c]));
          if (table === 'saved_items' && db.saved_items.some((x) => x.user_id === row.user_id && x.product_id === row.product_id)) return send(res, 409, { code: '23505', message: 'duplicate' });
          if (dup) { if (upsert) { out.push(db[table].find((x) => x[dup] === row[dup])); continue; } return send(res, 409, { code: '23505', message: `duplicate ${dup}` }); }
          db[table].push(row); out.push(row);
        }
        if (!/return=representation/.test(prefer)) return send(res, 201, '');
        return wantObj ? send(res, 201, out[0]) : send(res, 201, out);
      }
      if (req.method === 'PATCH' || req.method === 'DELETE') {
        const body = req.method === 'PATCH' ? JSON.parse((await readBody(req)).toString() || '{}') : null;
        const idsMatched = runSelect(table, url.searchParams, 'id').map((r) => r.id);
        const hit = db[table].filter((r) => idsMatched.includes(r.id));
        if (req.method === 'PATCH') hit.forEach((r) => Object.assign(r, body)); else db[table] = db[table].filter((r) => !idsMatched.includes(r.id));
        return send(res, 204, '');
      }
    }
    return send(res, 404, { message: `mock: unhandled ${req.method} ${p}` });
  } catch (e) { return send(res, 500, { message: String(e?.stack || e) }); }
});
server.listen(PORT, '127.0.0.1', () => console.log(`mock-supabase listening on http://127.0.0.1:${PORT}`));
