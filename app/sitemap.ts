import type { MetadataRoute } from 'next';
import { pub } from '@/lib/public';
import { PAGES } from '@/lib/pages';
import { DbError } from '@/lib/log';

// Generated on request (not frozen at build time, when the database may be unreachable). A database failure THROWS,
// so crawlers get a 5xx and retry later instead of receiving, and caching, a sitemap with no products in it.
export const dynamic = 'force-dynamic';
const LIMIT = 5000; // sitemap files may hold 50,000 URLs; raise this (or split the sitemap) when the catalogue grows

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const out: MetadataRoute.Sitemap = [{ url: site }, { url: `${site}/contact` }, ...Object.keys(PAGES).map((s) => ({ url: `${site}/${s}` }))];
  const [prods, cats] = await Promise.all([
    pub().from('products').select('slug,updated_at').eq('status', 'published').order('created_at', { ascending: false }).limit(LIMIT),
    pub().from('categories').select('slug').order('sort_order'),
  ]);
  if (prods.error) throw new DbError('sitemap.products', prods.error);
  if (cats.error) throw new DbError('sitemap.categories', cats.error);
  for (const c of cats.data ?? []) out.push({ url: `${site}/?cat=${c.slug}` }); // category landing pages are indexable
  for (const p of prods.data ?? []) out.push({ url: `${site}/products/${p.slug}`, lastModified: p.updated_at });
  return out;
}
