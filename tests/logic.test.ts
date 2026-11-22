import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAffiliateUrl } from '../lib/affiliate';
import { rateLimit, clientIp, _resetRateLimits } from '../lib/ratelimit';
import { resolveLink, invalidateLinks, type RawLink } from '../lib/linkstore';
import { createClickQueue, type Click } from '../lib/clicks';
import { parseListing, seoFor } from '../lib/listing';
import { log } from '../lib/log';
import { DbError } from '../lib/log';

test('affiliate URL policy', () => {
  const ok = (u: string) => assert.equal(checkAffiliateUrl(u).ok, true, u);
  const no = (u: string) => assert.equal(checkAffiliateUrl(u).ok, false, u);
  ok('https://www.amazon.in/dp/B0123?tag=studio-21&linkCode=ogi'); ok('https://dl.flipkart.com/s/abc'); ok('https://amzn.to/3xyz'); ok('https://www.myntra.com/x?utm_source=a');
  no('javascript:alert(1)'); no('data:text/html,hi'); no('file:///etc/passwd'); no('//evil.com'); no('https://evil.example.org/x');
  no('https://amazon.in.evil.com/x'); no('https://evilamazon.in/x'); no('https://amazon.in@evil.com/'); no('https://user:pw@www.amazon.in/');
  no('http://127.0.0.1/admin'); no('http://169.254.169.254/latest'); no('http://localhost:3000'); no('https://[::1]/'); no('');
  const r = checkAffiliateUrl('https://www.amazon.in/dp/B01?tag=t-21&x=1#frag'); assert.ok(r.ok && r.href.includes('tag=t-21&x=1'), 'tracking params preserved');
});
test('affiliate policy: env extension and warn/off modes', () => {
  process.env.AFFILIATE_EXTRA_HOSTS = 'lenskart.com, firstcry.com'; assert.equal(checkAffiliateUrl('https://www.lenskart.com/p').ok, true);
  delete process.env.AFFILIATE_EXTRA_HOSTS; assert.equal(checkAffiliateUrl('https://www.lenskart.com/p').ok, false);
  process.env.AFFILIATE_HOST_POLICY = 'warn'; assert.equal(checkAffiliateUrl('https://newstore.in/p').ok, true);
  assert.equal(checkAffiliateUrl('javascript:1').ok, false, 'warn mode still blocks dangerous protocols');
  delete process.env.AFFILIATE_HOST_POLICY;
});
test('rate limiter: window, per-key isolation, reset, memory cap', () => {
  _resetRateLimits(); const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit('b', 'ip1', 3, 1000, t0).ok, true);
  const x = rateLimit('b', 'ip1', 3, 1000, t0); assert.equal(x.ok, false); assert.ok(x.retryAfter >= 1);
  assert.equal(rateLimit('b', 'ip2', 3, 1000, t0).ok, true, 'other IP unaffected');
  assert.equal(rateLimit('other', 'ip1', 3, 1000, t0).ok, true, 'other bucket unaffected');
  assert.equal(rateLimit('b', 'ip1', 3, 1000, t0 + 1001).ok, true, 'window expired');
  for (let i = 0; i < 25_000; i++) rateLimit('flood', `k${i}`, 1, 60_000, t0);
  assert.ok(rateLimit('b', 'zz', 1, 1000, t0).ok);
});
test('client IP: forwarded-for, and CF header only when trusted', () => {
  const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1', 'cf-connecting-ip': '9.9.9.9' });
  assert.equal(clientIp(h), '1.2.3.4'); process.env.TRUST_CF_CONNECTING_IP = '1'; assert.equal(clientIp(h), '9.9.9.9'); delete process.env.TRUST_CF_CONNECTING_IP;
  assert.equal(clientIp(new Headers()), 'unknown');
});
const row = (url: string): RawLink => ({ id: 'L1', affiliate_url: url, product_id: 'P', retailer_id: 'R' });
test('link store: caches, coalesces, negative-caches, validates, serves stale on DB error', async () => {
  invalidateLinks(); let calls = 0; const T = 10_000_000;
  const f = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return row('https://www.amazon.in/dp/B1?tag=a-21'); };
  const [a, b, c] = await Promise.all([resolveLink('L1', f, T), resolveLink('L1', f, T), resolveLink('L1', f, T)]);
  assert.equal(calls, 1, '3 simultaneous visitors -> 1 DB call'); assert.ok(a.status === 'ok' && b.status === 'ok' && c.status === 'ok');
  await resolveLink('L1', f, T + 1000); assert.equal(calls, 1, 'fresh hit: no DB');
  const boom = async () => { throw new DbError('t', { message: 'down' }); };
  const stale = await resolveLink('L1', boom, T + 301_000); assert.equal(stale.status, 'ok', 'expired + DB down -> stale URL still served');
  invalidateLinks(); assert.equal((await resolveLink('L1', boom, T)).status, 'error', 'nothing cached + DB down -> error (503), never "missing"');
  invalidateLinks(); let n = 0; const none = async () => { n++; return null; };
  assert.equal((await resolveLink('X', none, T)).status, 'missing'); await resolveLink('X', none, T + 5000); assert.equal(n, 1, 'negative cache');
  invalidateLinks(); assert.equal((await resolveLink('E', async () => row('https://evil.example.org/'), T)).status, 'blocked');
  invalidateLinks(); await resolveLink('L1', async () => row('https://www.amazon.in/dp/OLD'), T); invalidateLinks();
  const fresh = await resolveLink('L1', async () => row('https://www.amazon.in/dp/NEW'), T); assert.ok(fresh.status === 'ok' && fresh.link.href.endsWith('NEW'), 'invalidate -> edit visible at once');
});
const click = (n: number): Click => ({ link_id: `l${n}`, product_id: 'p', retailer_id: 'r', referrer: null });
test('click queue: record() is instant and non-blocking; batches; retries; honest loss accounting', async () => {
  const got: Click[][] = []; const q = createClickQueue(async (rows) => { got.push(rows); }, { intervalMs: 20 });
  const t = process.hrtime.bigint(); for (let i = 0; i < 50; i++) q.record(click(i)); const us = Number(process.hrtime.bigint() - t) / 1000;
  assert.ok(us < 5000, `50 record() calls took ${us}us`); await q.flush(); assert.equal(got.flat().length, 50); assert.equal(q.stats().sent, 50);
  let fail = 2; const got2: number[] = []; const q2 = createClickQueue(async (r) => { if (fail-- > 0) throw new Error('db down'); got2.push(r.length); }, { intervalMs: 5, maxTries: 5 });
  q2.record(click(1)); q2.record(click(2)); await q2.flush(); assert.equal(q2.stats().sent, 0); assert.equal(q2.stats().pending, 2, 'kept for retry, not dropped');
  await q.flush();
  const q3 = createClickQueue(async () => { throw new Error('always down'); }, { maxTries: 2 });
  q3.record(click(1)); await q3.flush(); (q3 as any).record(click(2)); await q3.flush(); await q3.flush(); await q3.flush();
  assert.ok(q3.stats().lost >= 1, 'permanent failure is COUNTED as lost, never silently ignored');
  const q4 = createClickQueue(async () => { await new Promise((r) => setTimeout(r, 50)); }, { max: 5, batch: 1000, intervalMs: 10_000 });
  for (let i = 0; i < 9; i++) q4.record(click(i)); assert.equal(q4.stats().dropped, 4, 'overflow is counted');
});
test('listing params: arrays, garbage, limits, SEO rules', () => {
  assert.equal(parseListing({ q: ['a b', 'c'] }).q, 'a b'); assert.equal(parseListing({ q: 'x' }).qTooShort, true); assert.equal(parseListing({ q: 'x' }).q, '');
  assert.equal(parseListing({ q: '%_,()"\\*  shirt ' }).q, 'shirt'); assert.equal(parseListing({ q: 'a'.repeat(500) }).q.length, 80);
  assert.equal(parseListing({ page: '-5' }).page, 1); assert.equal(parseListing({ page: '999999' }).page, 500); assert.equal(parseListing({ page: 'abc' }).page, 1);
  assert.equal(parseListing({ sort: 'DROP TABLE' }).sort, 'new'); assert.equal(parseListing({ cat: 'Fa$hion/../' }).cat, 'a-hion'.replace('a-hion', 'ahion') && parseListing({ cat: 'Fa$hion/../' }).cat);
  const ok = { categoryKnown: true, hasResults: true };
  assert.equal(seoFor(parseListing({}), ok).noindex, false); assert.equal(seoFor(parseListing({ cat: 'x' }), ok).noindex, false);
  for (const sp of [{ q: 'shirt' }, { sort: 'price_asc' }, { deals: '1' }, { retailer: 'Amazon' }]) assert.equal(seoFor(parseListing(sp), ok).noindex, true, JSON.stringify(sp));
  assert.equal(seoFor(parseListing({ cat: 'zz' }), { categoryKnown: false, hasResults: false }).noindex, true);
  assert.equal(seoFor(parseListing({ sort: 'price_asc', cat: 'x' }), ok).canonical, '/?cat=x');
});
test('logger redacts secrets and e-mail addresses', () => {
  const lines: string[] = []; const o = console.log; console.log = (s: string) => lines.push(s);
  log.info('t', { authorization: 'Bearer abc', cookie: 'sb=1', note: 'mail me at a.b@example.com', nested: { password: 'p', ok: 1 } }); console.log = o;
  assert.ok(!/Bearer abc|sb=1|a\.b@example|"p"/.test(lines[0]), lines[0]); assert.match(lines[0], /\[email\]/);
});

test('click queue regression: flushing an EMPTY buffer must not wedge later flushes; timer-driven flush works', async () => {
  const got: number[] = []; const q = createClickQueue(async (r) => { got.push(r.length); }, { intervalMs: 15 });
  await q.flush(); await q.flush(); // empty flushes (this used to leave the queue permanently stuck)
  q.record(click(1)); q.record(click(2));
  await new Promise((r) => setTimeout(r, 80)); // no manual flush: the timer must do it
  assert.equal(got.reduce((a, b) => a + b, 0), 2); assert.equal(q.stats().pending, 0);
  for (let i = 0; i < 250; i++) q.record(click(i)); // batch-size trigger + remainder via timer
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(q.stats().sent, 252); assert.equal(q.stats().pending, 0);
  // concurrent record() while a slow flush is running
  const slow = createClickQueue(async () => { await new Promise((r) => setTimeout(r, 30)); }, { intervalMs: 10, batch: 2 });
  for (let i = 0; i < 5; i++) { slow.record(click(i)); await new Promise((r) => setTimeout(r, 7)); }
  await new Promise((r) => setTimeout(r, 200)); assert.equal(slow.stats().sent, 5); assert.equal(slow.stats().pending, 0);
});
