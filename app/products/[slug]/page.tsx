import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { pub } from '@/lib/public';
import { money, discount } from '@/lib/supabase';
import { retailerStyle } from '@/lib/retailers';
import ProductView from './ProductView';
import ProductCard from '../../ProductCard';
import AdSlot from '../../AdSlot';
import { getSite } from '@/lib/site';
import { DbError, log } from '@/lib/log';
import { imageAt } from '@/lib/img';

// Three outcomes, never confused:
//   found      -> the product
//   missing    -> null  (the query worked and there is no such published product)  => genuine 404
//   db problem -> throws DbError (Supabase down, slow, paused...)                   => error page, NOT a 404, never cached
const load = cache(async (slug: string) => {
  const { data, error } = await pub().from('products')
    .select('*, categories(name), brands(name), product_images(url,alt,sort_order), product_affiliate_links(id,display_price,priority,retailers(name))')
    .eq('slug', slug).eq('status', 'published').maybeSingle();
  if (error) throw new DbError('product.load', error);
  return (data ?? null) as any;
});
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  // notFound()/throw here happen BEFORE the page starts streaming, so the HTTP status is a real 404 / 500
  // (inside the page body, the root loading.tsx would already have sent "200 OK").
  let p: any;
  try { p = await load(params.slug); }
  catch { return { robots: { index: false } }; } // service problem: the page body below throws the same error and shows the in-layout error screen
  if (!p) notFound();
  const title = p.seo_title || p.name;
  const description = p.seo_description || p.short_description || undefined;
  const img = imageAt(p.main_image_url, 'lg');
  return { title, description, alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title, description, url: `/products/${p.slug}`, type: 'website', images: img ? [img] : [] },
    twitter: { card: img ? 'summary_large_image' : 'summary', title, description, images: img ? [img] : [] } };
}

const COLS = 'id,name,slug,main_image_url,price,original_price,currency,featured,trending,discount_pct,categories(name),brands(name)';
async function related(p: any): Promise<any[]> {
  const db = pub();
  // Same category first, topped up with the newest products. Both queries run at the same time.
  const [same, latest]: any[] = await Promise.all([
    p.category_id
      ? db.from('products').select(COLS).eq('status', 'published').eq('category_id', p.category_id).neq('id', p.id).order('created_at', { ascending: false }).limit(4)
      : Promise.resolve({ data: [] }),
    db.from('products').select(COLS).eq('status', 'published').neq('id', p.id).order('created_at', { ascending: false }).limit(8),
  ]);
  if (same.error || latest.error) log.warn('product.related_failed', { code: (same.error || latest.error)?.code }); // optional section: page still renders
  const out: any[] = [...(same.data ?? [])];
  for (const x of latest.data ?? []) if (out.length < 4 && !out.some((o) => o.id === x.id)) out.push(x);
  return out;
}

const STALE_DAYS = 30;
export default async function Product({ params }: { params: { slug: string } }) {
  const p = await load(params.slug);
  if (!p) notFound();
  const links = [...p.product_affiliate_links].sort((a: any, b: any) => a.priority - b.priority).map((l: any) => {
    const st = retailerStyle(l.retailers.name);
    return { id: l.id, name: l.retailers.name, bg: st.backgroundColor, fg: st.color, price: l.display_price != null ? money(l.display_price, p.currency) : null };
  });
  const images = [p.main_image_url, ...[...(p.product_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order).map((i: any) => i.url)].filter(Boolean);
  const hasOriginal = p.original_price != null && p.price != null && p.original_price > p.price;
  const checked = p.price != null && p.price_checked_at ? new Date(p.price_checked_at) : null;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  // Structured data for search engines. Only facts we actually have: no ratings, no stock status.
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name,
    ...(images.length ? { image: images } : {}),
    ...((p.short_description || p.description) ? { description: String(p.short_description || p.description).slice(0, 500) } : {}),
    ...(p.brands?.name ? { brand: { '@type': 'Brand', name: p.brands.name } } : {}),
    ...(p.categories?.name ? { category: p.categories.name } : {}),
    ...(p.price != null ? { offers: { '@type': 'Offer', price: p.price, priceCurrency: p.currency, url: `${site}/products/${p.slug}` } } : {}),
  };
  const [rel, cfg] = await Promise.all([related(p), getSite()]);
  // Only show an ad on product pages with real written content (Google disallows ads on thin pages).
  const richEnough = String(p.description || '').length >= 200 || Object.keys(p.specifications || {}).length >= 3;
  const showAd = cfg.ads.enabled && !!cfg.ads.client && !!cfg.ads.slotProduct && richEnough;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <ProductView ad={showAd ? <AdSlot client={cfg.ads.client} slot={cfg.ads.slotProduct} compact /> : null} data={{
        name: p.name, category: p.categories?.name ?? null, brand: p.brands?.name ?? null, price: money(p.price, p.currency),
        original: hasOriginal ? money(p.original_price, p.currency) : null, discount: discount(p.price, p.original_price),
        priceChecked: checked ? checked.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
        priceStale: checked ? Date.now() - checked.getTime() > STALE_DAYS * 86400000 : false,
        description: p.description || p.short_description || '',
        specs: Object.entries(p.specifications || {}).map(([k, v]) => [k, String(v)] as [string, string]),
        images, links,
      }} />
      {rel.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="font-display text-2xl font-extrabold uppercase">You may also like</h2>
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">{rel.map((r) => <li key={r.id}><ProductCard p={r} /></li>)}</ul>
        </section>
      )}
    </>
  );
}
