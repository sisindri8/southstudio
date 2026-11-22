'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { admin, requireAdmin } from '@/lib/supabase';
import { retailerFromUrl } from '@/lib/retailers';
import { checkUrl, pool } from '@/lib/linkcheck';
import { checkAffiliateUrl } from '@/lib/affiliate';
import { invalidateLinks } from '@/lib/linkstore';
import { uploadOptimized, MAX_BYTES } from '@/lib/images';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const UUID = /^[0-9a-f-]{36}$/i;
// Public pages are cached for 60 s; this makes admin changes show up immediately.
const refresh = () => { revalidateTag('db'); revalidatePath('/', 'layout'); invalidateLinks(); }; // invalidateLinks: /go must see edits at once

// Server-action errors are hidden in production, so turn them into a readable ?err= message on the same page.
function msgOf(e: any) {
  if (e instanceof z.ZodError) { const i = e.issues[0]; return i ? `${i.path.join('.') || 'Form'}: ${i.message}` : 'Invalid input'; }
  return String(e?.message || 'Something went wrong').slice(0, 300);
}
async function guard(path: string, fn: () => Promise<void>) {
  try { await fn(); }
  catch (e: any) {
    if (typeof e?.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) throw e;
    redirect(`${path}?err=${encodeURIComponent(msgOf(e))}`);
  }
}

const num = z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().nonnegative().nullable());
const Schema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  name: z.string().trim().min(2).max(200),
  category_id: z.string().uuid().optional().or(z.literal('')),
  short_description: z.string().max(500).optional(), description: z.string().max(10000).optional(),
  price: num, original_price: num,
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter code such as INR').default('INR'),
  status: z.enum(['draft', 'published', 'archived']),
  links: z.string().max(5000).optional(),
  brand: z.string().trim().max(80).optional(),
  specs: z.string().max(4000).optional(),
  seo_title: z.string().trim().max(70).optional(),
  seo_description: z.string().trim().max(200).optional(),
});

// Validates, converts to WebP in 3 sizes (sharp) and uploads them. Returns the stored URL, or null when no file was chosen.
// Nothing is written unless the whole image processed successfully, and the uploaded file itself is never altered.
async function uploadTo(db: ReturnType<typeof admin>, f: File | null, folder = '') {
  if (!f || !f.size) return null;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > MAX_BYTES) throw new Error('Images must be JPG, PNG or WebP under 5 MB');
  return uploadOptimized(db, process.env.SUPABASE_STORAGE_BUCKET || 'product-images', f, folder);
}

// "Label: value" per line -> JSON object stored in products.specifications
function parseSpecs(text: string) {
  const entries: [string, string][] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim(); if (!line) continue;
    const i = line.indexOf(':');
    const k = i > 0 ? line.slice(0, i).trim().slice(0, 60) : '', val = i > 0 ? line.slice(i + 1).trim().slice(0, 200) : '';
    if (!k || !val) throw new Error(`Specification lines must look like "Label: value". Check: ${line.slice(0, 60)}`);
    entries.push([k, val]);
  }
  if (entries.length > 30) throw new Error('Up to 30 specification lines are allowed');
  return Object.fromEntries(entries);
}
async function ensureBrand(db: ReturnType<typeof admin>, name: string): Promise<string> {
  const found = await db.from('brands').select('id').ilike('name', name.replace(/[%_\\]/g, '')).maybeSingle();
  if (found.data) return found.data.id;
  const base = slugify(name) || 'brand';
  let slug = base;
  for (let i = 0; i < 3; i++) {
    const { data, error } = await db.from('brands').insert({ name, slug }).select('id').single();
    if (!error) return data.id;
    if (error.code !== '23505') throw new Error(error.message);
    const again = await db.from('brands').select('id').eq('name', name).maybeSingle(); // created meanwhile
    if (again.data) return again.data.id;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  throw new Error('Could not save the brand');
}

export async function saveProduct(fd: FormData) {
  const rid = String(fd.get('id') || '');
  await guard(UUID.test(rid) ? `/admin/products/${rid}` : '/admin/products', async () => {
    await requireAdmin();
    const v = Schema.parse(Object.fromEntries(fd));
    // Validate everything before uploading anything, so a typo doesn't leave orphaned images behind.
    const urls = [...new Set((v.links || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/https?:\/\/\S+/i);
      if (!m) throw new Error(`No valid link found in: ${l.slice(0, 80)}`);
      const chk = checkAffiliateUrl(m[0]);
      if (!chk.ok) throw new Error(`Link not accepted (${chk.reason}): ${m[0].slice(0, 80)}. To allow a new store, add its domain to AFFILIATE_EXTRA_HOSTS in Render.`);
      return m[0];
    }))];
    const db = admin();
    const specifications = parseSpecs(v.specs || '');
    const main = await uploadTo(db, fd.get('main_image') as File); // one image at a time: keeps memory low on a 512 MB server
    const brand_id = v.brand ? await ensureBrand(db, v.brand) : null;
    // Stamp "price checked" for new products, when a price changed, or when the admin ticks the box.
    let stamp = fd.get('price_checked') === 'on' || !v.id;
    if (v.id) {
      const { data: prev } = await db.from('products').select('price,original_price').eq('id', v.id).maybeSingle();
      if (prev && (Number(prev.price ?? -1) !== Number(v.price ?? -1) || Number(prev.original_price ?? -1) !== Number(v.original_price ?? -1))) stamp = true;
    }
    const now = new Date().toISOString();
    const fields = {
      name: v.name, category_id: v.category_id || null, short_description: v.short_description, description: v.description,
      price: v.price, original_price: v.original_price, currency: v.currency.toUpperCase(), status: v.status,
      featured: fd.get('featured') === 'on', trending: fd.get('trending') === 'on', updated_at: now,
      specifications, brand_id, seo_title: v.seo_title || null, seo_description: v.seo_description || null,
      ...(stamp && v.price != null ? { price_checked_at: now } : {}),
    };

    let id = v.id || '';
    if (id) {
      const { error } = await db.from('products').update(main ? { ...fields, main_image_url: main } : fields).eq('id', id);
      if (error) throw new Error(error.message);
    } else {
      let slug = slugify(v.name) || 'product';
      for (let i = 0; i < 3 && !id; i++) {
        const { data, error } = await db.from('products').insert({ ...fields, slug, main_image_url: main }).select('id').single();
        if (!error) { id = data.id; break; }
        if (error.code !== '23505') throw new Error(error.message);
        slug = `${slugify(v.name) || 'product'}-${Math.random().toString(36).slice(2, 6)}`;
      }
      if (!id) throw new Error('Could not create product');
    }

    // Gallery: remove ticked images, add new ones
    const remove = fd.getAll('remove_image').map(String).filter((x) => UUID.test(x));
    if (remove.length) await db.from('product_images').delete().eq('product_id', id).in('id', remove);
    const { count } = await db.from('product_images').select('*', { count: 'exact', head: true }).eq('product_id', id);
    const added: string[] = [];
    for (const f of fd.getAll('gallery') as File[]) { const u = await uploadTo(db, f); if (u) added.push(u); } // sequential on purpose
    if (added.length) {
      const { error: ie } = await db.from('product_images').insert(added.map((url, i) => ({ product_id: id, url, sort_order: (count ?? 0) + i })));
      if (ie) throw new Error(ie.message);
    }

    // Links: one pasted URL per line; the retailer is detected from the URL.
    const { data: existing } = await db.from('product_affiliate_links').select('id,affiliate_url').eq('product_id', id);
    const keep = new Set(urls);
    const del = (existing ?? []).filter((e) => !keep.has(e.affiliate_url)).map((e) => e.id);
    if (del.length) await db.from('product_affiliate_links').delete().in('id', del);
    const have = new Map((existing ?? []).map((e) => [e.affiliate_url, e.id]));
    await Promise.all(urls.map((url, i) => have.has(url) ? db.from('product_affiliate_links').update({ priority: i }).eq('id', have.get(url)!) : null));
    for (const [i, url] of urls.entries()) {
      if (have.has(url)) continue;
      const { data: r, error: re } = await db.from('retailers').upsert({ name: retailerFromUrl(url) }, { onConflict: 'name' }).select('id').single();
      if (re || !r) throw new Error(re?.message ?? 'Could not save retailer');
      const { error: le } = await db.from('product_affiliate_links').insert({ product_id: id, retailer_id: r.id, affiliate_url: url, priority: i });
      if (le) throw new Error(le.message);
    }
    refresh(); revalidatePath('/admin/products');
    redirect('/admin/products');
  });
}

export async function setStatus(fd: FormData) {
  await guard('/admin/products', async () => {
    await requireAdmin();
    const id = z.string().uuid().parse(fd.get('id'));
    const status = z.enum(['draft', 'published', 'archived']).parse(fd.get('status'));
    const { error } = await admin().from('products').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    refresh(); revalidatePath('/admin/products');
  });
}
export async function deleteProduct(fd: FormData) {
  await guard('/admin/products', async () => {
    await requireAdmin();
    const { error } = await admin().from('products').delete().eq('id', z.string().uuid().parse(fd.get('id')));
    if (error) throw new Error(error.message);
    refresh(); revalidatePath('/admin/products');
  });
}

// ---------- Site settings (logo, carousel, CTA, Instagram, socials) ----------
// Relative links must start with a single "/" (not "//"), so they cannot point to another site by accident.
const LinkS = z.string().trim().max(500).refine((v) => v === '' || /^(\/(?!\/)|#|https?:\/\/)/i.test(v), 'Links must start with /, # or http(s)://');

export async function saveSettings(fd: FormData) {
  await guard('/admin/settings', async () => {
    await requireAdmin();
    const db = admin();
    const { data: row } = await db.from('website_settings').select('value').eq('key', 'site').maybeSingle();
    const old: any = row?.value ?? {};
    const text = (n: string, max = 200) => String(fd.get(n) ?? '').trim().slice(0, max);
    const link = (n: string) => LinkS.parse(String(fd.get(n) ?? ''));

    // 1) Validate every link first, before any upload.
    const slideMeta = Array.from({ length: 5 }, (_, i) => ({
      title: text(`slide${i}_title`, 80), subtitle: text(`slide${i}_subtitle`, 160), button: text(`slide${i}_button`, 30), link: link(`slide${i}_link`),
    }));
    const cta = { text: text('cta_text', 120), button: text('cta_button', 30), link: link('cta_link') };
    const socials = { instagram: link('s_instagram'), youtube: link('s_youtube'), pinterest: link('s_pinterest'), x: link('s_x') };

    // Advertising (Google AdSense): validated here so a typo can never break the public pages.
    const adClient = text('ads_client', 40);
    if (adClient && !/^ca-pub-\d{10,20}$/.test(adClient)) throw new Error('Publisher ID must look like ca-pub-1234567890123456 (copy it from your AdSense account)');
    const slot = (n: string) => { const v = text(n, 20); if (v && !/^\d{6,20}$/.test(v)) throw new Error('Ad unit IDs are numbers only (about 10 digits). Copy the data-ad-slot value.'); return v; };
    const ads = { enabled: fd.get('ads_enabled') === 'on', client: adClient, slotHome: slot('ads_slot_home'), slotListing: slot('ads_slot_listing'), slotProduct: slot('ads_slot_product') };
    if (ads.enabled && !ads.client) throw new Error('Enter your Publisher ID before turning ads on');

    // 2) Uploads. New upload wins; "Remove" clears; otherwise keep the existing image.
    const img = async (n: string, prev?: string) => {
      if (fd.get(`${n}_remove`) === 'on') return '';
      return (await uploadTo(db, fd.get(n) as File | null, 'site/')) ?? prev ?? '';
    };
    const slides = [];
    for (let i = 0; i < 5; i++) {
      const image = await img(`slide${i}_image`, old.slides?.[i]?.image);
      if (image || slideMeta[i].title) slides.push({ image, ...slideMeta[i] });
    }
    const value = {
      logo: await img('logo', old.logo), slides, cta,
      instagram: { title: text('ig_title', 80), text: text('ig_text', 300), image: await img('ig_image', old.instagram?.image), logo: await img('ig_logo', old.instagram?.logo) },
      disclosure: text('disclosure', 1500), socials, ads,
    };
    const { error } = await db.from('website_settings').upsert({ key: 'site', value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    refresh();
    redirect('/admin/settings?saved=1');
  });
}

// ---------- Categories and dropdown options ----------
export async function saveCategory(fd: FormData) {
  await guard('/admin/categories', async () => {
    await requireAdmin();
    const v = z.object({
      id: z.string().uuid().optional().or(z.literal('')), parent_id: z.string().uuid().optional().or(z.literal('')),
      name: z.string().trim().min(1).max(60), sort_order: z.coerce.number().int().min(0).max(999).default(0),
    }).parse(Object.fromEntries(fd));
    const db = admin();
    let image: string | null | undefined; // undefined = leave unchanged
    if (fd.get('image_remove') === 'on') image = null;
    const up = await uploadTo(db, fd.get('image') as File | null, 'site/');
    if (up) image = up;
    if (v.id) {
      const { error } = await db.from('categories').update({ name: v.name, sort_order: v.sort_order, ...(image !== undefined ? { image_url: image } : {}) }).eq('id', v.id);
      if (error) throw new Error(error.message);
    } else {
      let base = slugify(v.name) || 'category';
      if (v.parent_id) { const { data: par } = await db.from('categories').select('slug').eq('id', v.parent_id).maybeSingle(); if (par) base = `${par.slug}-${base}`; }
      let slug = base, done = false;
      for (let i = 0; i < 4 && !done; i++) {
        const { error } = await db.from('categories').insert({ name: v.name, slug, parent_id: v.parent_id || null, sort_order: v.sort_order, image_url: image ?? null });
        if (!error) { done = true; break; }
        if (error.code !== '23505') throw new Error(error.message);
        slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      }
      if (!done) throw new Error('Could not create the category (name clash). Try a different name.');
    }
    refresh(); revalidatePath('/admin/categories');
  });
}
export async function deleteCategory(fd: FormData) {
  await guard('/admin/categories', async () => {
    await requireAdmin();
    const { error } = await admin().from('categories').delete().eq('id', z.string().uuid().parse(fd.get('id')));
    if (error) throw new Error(error.message);
    refresh(); revalidatePath('/admin/categories');
  });
}

// ---------- Contact messages ----------
export async function deleteMessage(fd: FormData) {
  await guard('/admin/messages', async () => {
    await requireAdmin();
    const { error } = await admin().from('contact_messages').delete().eq('id', z.string().uuid().parse(fd.get('id')));
    if (error) throw new Error(error.message);
    revalidatePath('/admin/messages');
  });
}

// ---------- Link checker ----------
export async function checkLinks() {
  await guard('/admin/links', async () => {
    await requireAdmin();
    const db = admin();
    // Oldest-checked first, 40 per run, so repeated clicks work through the whole list.
    const { data, error } = await db.from('product_affiliate_links').select('id,affiliate_url').order('last_checked_at', { ascending: true, nullsFirst: true }).limit(40);
    if (error) throw new Error(error.message);
    await pool(data ?? [], 5, async (l) => {
      const r = await checkUrl(l.affiliate_url);
      await db.from('product_affiliate_links').update({ last_status: r.status, last_error: r.error, last_checked_at: new Date().toISOString() }).eq('id', l.id);
    });
    revalidatePath('/admin/links');
    redirect('/admin/links?done=1');
  });
}

// ---------- Email list ----------
export async function deleteSubscriber(fd: FormData) {
  await guard('/admin/subscribers', async () => {
    await requireAdmin();
    const { error } = await admin().from('subscribers').delete().eq('id', z.string().uuid().parse(fd.get('id')));
    if (error) throw new Error(error.message);
    revalidatePath('/admin/subscribers');
  });
}
