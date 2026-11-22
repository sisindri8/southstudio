import { admin, requireAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function run() {
  const out: [string, boolean, string][] = [];
  const add = (n: string, ok: boolean, m: string) => out.push([n, ok, m]);
  let db;
  try { db = admin(); add('Service key (SUPABASE_SERVICE_ROLE_KEY)', true, 'Looks valid'); }
  catch (e: any) { add('Service key (SUPABASE_SERVICE_ROLE_KEY)', false, e.message); return out; }
  const w = await db.from('website_settings').upsert({ key: '__check', value: {} });
  if (w.error) add('Database write', false, `${w.error.message}. A wrong service key causes this.`);
  else { add('Database write', true, 'OK'); await db.from('website_settings').delete().eq('key', '__check'); }
  const c = await db.from('categories').select('parent_id,sort_order').limit(1);
  add('Migration 0002 (sub categories)', !c.error, c.error ? `${c.error.message}. Run supabase/migrations/0002_categories.sql in the SQL Editor.` : 'OK');
  const url = process.env.NEXT_PUBLIC_SITE_URL || '';
  const bad = !url || (process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(url));
  add('Site URL (NEXT_PUBLIC_SITE_URL)', !bad, bad ? 'Set it to your real https address (sitemap and SEO use it), then redeploy. It is baked in at build time.' : url);
  const m = await db.from('contact_messages').select('id', { count: 'exact', head: true });
  add('Migrations 0001 to 0003', !m.error, m.error ? m.error.message : 'OK (run 0003_hardening.sql if you have not yet)');
  const f = await db.from('products').select('price_checked_at,discount_pct').limit(1);
  add('Migration 0004 (analytics, discounts, link checker)', !f.error, f.error ? `${f.error.message}. Run supabase/migrations/0004_features.sql in the SQL Editor.` : 'OK');
  const sub = await db.from('subscribers').select('id', { count: 'exact', head: true });
  add('Migration 0005 (email list)', !sub.error, sub.error ? `${sub.error.message}. Run supabase/migrations/0005_subscribers.sql in the SQL Editor.` : 'OK');
  const sv = await db.from('saved_items').select('product_id', { count: 'exact', head: true });
  add('Migration 0006 (saved items)', !sv.error, sv.error ? `${sv.error.message}. Run supabase/migrations/0006_saved_items.sql in the SQL Editor.` : 'OK');
  const tsSite = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, tsSecret = !!process.env.TURNSTILE_SECRET_KEY;
  add('Spam check (Turnstile, optional)', tsSite === tsSecret, tsSite && tsSecret ? 'On for the contact and email forms' : tsSite || tsSecret ? 'Only one of the two keys is set, so it is OFF. Set both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, then redeploy.' : 'Off (honeypot only). Add both keys to turn it on.');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
  const b = await db.storage.getBucket(bucket);
  add(`Storage bucket "${bucket}"`, !b.error, b.error ? `${b.error.message}. Create a public bucket with this name under Storage.` : 'OK');
  const up = await db.storage.from(bucket).upload(`site/__check-${Date.now()}.txt`, new Blob(['ok']), { contentType: 'text/plain' });
  if (up.error) add('Image upload to storage', false, up.error.message);
  else { add('Image upload to storage', true, 'OK'); await db.storage.from(bucket).remove([up.data.path]); }
  const n = async (t: string, col: string) => (await db.from(t).select('*', { count: 'exact', head: true }).not(col, 'is', null)).count ?? 0;
  const { data: st } = await db.from('website_settings').select('value').eq('key', 'site').maybeSingle();
  const v: any = st?.value ?? {};
  const siteImgs = [v.logo, v.instagram?.image, v.instagram?.logo, ...(v.slides ?? []).map((x: any) => x.image)].filter(Boolean).length;
  add('Images saved in database', true, `Product main images: ${await n('products', 'main_image_url')} · Gallery images: ${await n('product_images', 'url')} · Category photos: ${await n('categories', 'image_url')} · Site images (logo, banners, Instagram): ${siteImgs}`);
  return out;
}
export default async function Setup() {
  await requireAdmin();
  const results = await run();
  return (
    <div className="max-w-2xl space-y-4 border border-line bg-white p-5 sm:p-6">
      <h1 className="font-display text-3xl font-extrabold uppercase">Setup check</h1>
      <ul className="space-y-2">
        {results.map(([n, ok, m]) => (
          <li key={n} className={`border p-3 text-sm ${ok ? 'border-line' : 'border-flare bg-flare/10'}`}>
            <strong>{ok ? '✓' : '✗'} {n}</strong><br />{m}
          </li>
        ))}
      </ul>
    </div>
  );
}
