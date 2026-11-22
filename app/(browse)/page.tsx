import Link from 'next/link';
import { cache } from 'react';
import type { Metadata } from 'next';
import Carousel from '../Carousel';
import ProductCard from '../ProductCard';
import AdSlot from '../AdSlot';
import OptImage from '../OptImage';
import { getSite, getNav, getCategories, type Site, type NavCat } from '@/lib/site';
import { pub, pubFresh } from '@/lib/public';
import { DbError, log } from '@/lib/log';
import { PAGE_SIZE as PAGE, SORTS, parseListing, seoFor, type RawParams } from '@/lib/listing';

export const revalidate = 60;

const COLS = 'id,name,slug,main_image_url,price,original_price,currency,featured,trending,discount_pct,categories(name),brands(name)';

// Everything the page needs from the database, loaded ONCE per request (React cache) and shared by
// generateMetadata and the page. A database failure THROWS (-> error page with a 5xx status, never cached);
// it is never shown as "No products match" and never turned into a 404.
const loadHome = cache(async (key: string) => {
  const sp = Object.fromEntries(new URLSearchParams(key)) as RawParams;
  const l = parseListing(sp);
  // Free-text search is NOT stored in Next's on-disk data cache (every distinct query would add a permanent file).
  const db = l.q ? pubFresh(6000) : pub();
  const [cats, retRes] = await Promise.all([getCategories(), pub().from('retailers').select('id,name').order('name')]);
  if (retRes.error) throw new DbError('home.retailers', retRes.error);
  const retailers: { id: string; name: string }[] = retRes.data ?? [];
  const retailer = retailers.find((r) => r.name === l.retailerName);
  let ids: string[] | null = null; let catName = '';
  const catObj = l.cat ? cats.find((x) => x.slug === l.cat) : undefined;
  if (l.cat) { catName = catObj?.name ?? ''; ids = catObj ? [catObj.id, ...cats.filter((k) => k.parent_id === catObj.id).map((k) => k.id)] : []; }
  let query: any = db.from('products').select(retailer ? `${COLS},product_affiliate_links!inner(retailer_id)` : COLS, { count: 'exact' }).eq('status', 'published');
  if (retailer) query = query.eq('product_affiliate_links.retailer_id', retailer.id);
  if (l.q) {
    const like = `%${l.q}%`;
    const needle = l.q.toLowerCase();
    const mids = cats.filter((x) => x.name.toLowerCase().includes(needle)).map((x) => x.id);
    const cids = [...new Set([...mids, ...cats.filter((x) => x.parent_id && mids.includes(x.parent_id)).map((x) => x.id)])];
    const parts = [`name.ilike.${like}`, `short_description.ilike.${like}`, `description.ilike.${like}`];
    if (cids.length) parts.push(`category_id.in.(${cids.join(',')})`);
    query = query.or(parts.join(','));
  }
  if (ids) query = query.in('category_id', ids);
  if (l.deals) query = query.gt('discount_pct', 0);
  // created_at is the tie-breaker for every sort so pages never repeat or skip products between page 1 and 2.
  if (l.sort === 'discount') query = query.order('discount_pct', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  else if (l.sort === 'price_asc') query = query.order('price', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
  else if (l.sort === 'price_desc') query = query.order('price', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  else query = query.order('created_at', { ascending: false });
  query = query.range((l.page - 1) * PAGE, l.page * PAGE - 1);

  const filtered = !!(l.q || l.cat || l.deals || retailer || l.sort !== 'new');
  const showRows = !filtered && l.page === 1;
  const row = (flag: 'featured' | 'trending') => db.from('products').select(COLS).eq('status', 'published').eq(flag, true).order('created_at', { ascending: false }).limit(8);
  const [main, feat, trend, site, nav] = await Promise.all([
    query,
    showRows ? row('featured') : Promise.resolve({ data: [] as any[], error: null }),
    showRows ? row('trending') : Promise.resolve({ data: [] as any[], error: null }),
    getSite(), getNav(),
  ]) as any[];
  if (main.error) throw new DbError('home.products', main.error);
  // The optional Featured/Trending rows may fail without taking the page down: they are simply left out.
  if (feat.error || trend.error) log.warn('home.rows_failed', { featured: !!feat.error, trending: !!trend.error });
  return { l, retailers, retailer, catName, catKnown: !!catObj, filtered, showRows, data: main.data as any[] | null, count: main.count as number | null, feat: (feat.data ?? []) as any[], trend: (trend.data ?? []) as any[], site: site as Site, nav: nav as NavCat[] };
});
const keyOf = (sp: RawParams) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) { const x = Array.isArray(v) ? v[0] : v; if (x != null) u.set(k, x); } return u.toString(); };

export async function generateMetadata({ searchParams }: { searchParams: RawParams }): Promise<Metadata> {
  let h: Awaited<ReturnType<typeof loadHome>>;
  try { h = await loadHome(keyOf(searchParams)); }
  catch { return { robots: { index: false, follow: true } }; } // the page body throws the same error -> in-layout error screen
  const seo = seoFor(h.l, { categoryKnown: h.catKnown, hasResults: (h.data?.length ?? 0) > 0 });
  return {
    ...(h.catName && !h.l.q ? { title: h.catName } : {}),
    // Next's metadata API drops the ?query of any canonical whose path is "/", so a canonical for /?cat=x cannot be expressed
    // (it would wrongly point at the home page). We therefore emit a canonical only for the plain home page and its duplicates.
    // Indexable category pages emit none (Google then treats the page as its own canonical); duplicates are noindex,follow.
    ...(seo.canonical === '/' ? { alternates: { canonical: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '') } } : {}),
    robots: seo.noindex ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function Home({ searchParams }: { searchParams: RawParams }) {
  const h = await loadHome(keyOf(searchParams));
  const { l, retailers, retailer, catName, filtered, showRows, data, count, site, nav } = h;
  const { q, cat, sort, deals, page } = l;
  const products: any[] = data ?? [];
  const featured = h.feat;
  const trending = h.trend;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const banners = site.slides.filter((x) => x.image);
  const href = (p: number) => { const u = new URLSearchParams(); if (q) u.set('q', q); if (cat) u.set('cat', cat); if (sort !== 'new') u.set('sort', sort); if (deals) u.set('deals', '1'); if (retailer) u.set('retailer', retailer.name); if (p > 1) u.set('page', String(p)); const s = u.toString(); return s ? `/?${s}` : '/'; };
  const ad = (slot: string) => (site.ads.enabled && site.ads.client && slot ? <AdSlot client={site.ads.client} slot={slot} /> : null);
  const reset = (() => { const u = new URLSearchParams(); if (q) u.set('q', q); if (cat) u.set('cat', cat); const s = u.toString(); return s ? `/?${s}` : '/'; })();
  const row = (title: string, list: any[], first = false) => list.length > 0 && (
    <section className="mx-auto max-w-6xl px-4 pt-10">
      <h2 className="font-display text-2xl font-extrabold uppercase">{title}</h2>
      <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">{list.map((p, n) => <li key={p.id}><ProductCard p={p} priority={first && !banners.length && n < 4} /></li>)}</ul>
    </section>
  );

  return (
    <>
      {!filtered && page === 1 && banners.length > 0 && <section className="mx-auto max-w-6xl px-4 pt-8"><Carousel slides={banners} /></section>}
      {row('Trending now', trending, true)}
      {row('Featured picks', featured, !trending.length)}
      {showRows && (trending.length > 0 || featured.length > 0) && ad(site.ads.slotHome)}

      <section id="shop" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-10">
        <h2 className="font-display text-2xl font-extrabold uppercase">{q ? `Results for “${q}”` : cat ? catName || 'Category' : 'Latest arrivals'}</h2>
        <form action="/" className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {q && <input type="hidden" name="q" value={q} />}
          {cat && <input type="hidden" name="cat" value={cat} />}
          <label className="flex items-center gap-2">Sort
            <select name="sort" defaultValue={sort} className="field w-auto">{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {retailers.length > 1 && <label className="flex items-center gap-2">Store
            <select name="retailer" defaultValue={retailer?.name ?? ''} className="field w-auto"><option value="">All stores</option>{retailers.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}</select></label>}
          <label className="flex items-center gap-2"><input type="checkbox" name="deals" value="1" defaultChecked={deals} /> Deals only</label>
          <button className="btn">Apply</button>
          {filtered && <Link href={reset} className="underline">Reset filters</Link>}
        </form>
        {l.qTooShort && <p className="mt-6 text-ink/70">Please type at least 2 characters to search.</p>}
        {!products.length && <p className="mt-8 text-ink/70">{filtered ? 'No products match. Try changing the filters.' : 'Nothing here yet. Check back soon.'}</p>}
        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {products.map((p) => <li key={p.id}><ProductCard p={p} /></li>)}
        </ul>
        {pages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4 text-sm font-semibold">
            {page > 1 ? <Link href={href(page - 1)} rel="prev" className="border-2 border-ink px-4 py-2 hover:bg-lime">← Previous</Link> : <span className="px-4 py-2 text-ink/30">← Previous</span>}
            <span>Page {page} of {pages}</span>
            {page < pages ? <Link href={href(page + 1)} rel="next" className="border-2 border-ink px-4 py-2 hover:bg-lime">Next →</Link> : <span className="px-4 py-2 text-ink/30">Next →</span>}
          </nav>
        )}
      </section>
      {products.length >= 8 && ad(site.ads.slotListing)}

      {!filtered && nav.length > 1 && (
        <section className="bg-chalk"><div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide sm:text-5xl">Modern Room</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-ink/70 sm:text-base">Browse our top categories and find fashion, clothing, electronics and more in one place.</p>
          <ul className="mt-4 flex justify-start overflow-x-auto px-3 pb-10 pt-8 sm:justify-center">
            {nav.map((c, i) => (
              <li key={c.slug} className={`relative -mx-1 w-1/4 min-w-[110px] max-w-[190px] shrink-0 focus-within:z-10 sm:-mx-2 [&:has(.slant:hover)]:z-10 ${i % 2 ? 'translate-y-4' : ''}`}>
                <Link href={`/?cat=${c.slug}`} aria-label={c.name} className="group block">
                  <div className="slant relative aspect-[3/4] w-full bg-ink transition-transform duration-300 ease-out group-focus-visible:scale-110 motion-reduce:transition-none [@media(hover:hover)]:hover:scale-110">
                    {c.image && <OptImage src={c.image} alt="" sizes="190px" width={190} height={253} className="absolute inset-0 h-full w-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
                    <span className="absolute bottom-3 left-[18%] right-[12%] text-center text-xs font-bold uppercase tracking-wider text-white sm:text-sm">{c.name}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div></section>
      )}
    </>
  );
}
