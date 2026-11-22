// Pure helpers for the home/search/category listing. No I/O, so they are unit-tested (tests/listing.test.ts).

export const PAGE_SIZE = 24;
export const MAX_PAGE = 500;
export const MIN_QUERY = 2;
export const SORTS: Record<string, string> = { new: 'Newest', discount: 'Biggest discount', price_asc: 'Price: low to high', price_desc: 'Price: high to low' };

export type RawParams = Record<string, string | string[] | undefined>;
export type Listing = {
  q: string; qTooShort: boolean; cat: string; sort: string; deals: boolean; page: number; retailerName: string;
};

// ?q=a&q=b arrives as an array. The original code called .replace() on it and crashed; take the first value instead.
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '');

export function parseListing(sp: RawParams): Listing {
  // Characters that have a meaning inside PostgREST filter strings (, ( ) " \ * and LIKE wildcards) are removed.
  const rawQ = one(sp.q).replace(/[%_,()"\\*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const sortRaw = one(sp.sort);
  return {
    q: rawQ.length >= MIN_QUERY ? rawQ : '',
    qTooShort: rawQ.length > 0 && rawQ.length < MIN_QUERY,
    cat: one(sp.cat).replace(/[^a-z0-9-]/g, '').slice(0, 60),
    sort: Object.prototype.hasOwnProperty.call(SORTS, sortRaw) ? sortRaw : 'new',
    deals: one(sp.deals) === '1',
    page: Math.min(Math.max(parseInt(one(sp.page) || '1', 10) || 1, 1), MAX_PAGE),
    retailerName: one(sp.retailer).slice(0, 60),
  };
}

// Which URLs should Google index?
//  * "/" and "/?cat=<slug>" (and their ?page=N) are real browse pages: indexable, canonical to themselves.
//  * Anything with search text, a sort, the deals filter or a store filter is a duplicate view of the same products:
//    noindex,follow, with the canonical pointing at the plain page it was derived from.
export function seoFor(l: Listing, opts: { categoryKnown: boolean; hasResults: boolean }) {
  const duplicate = !!(l.q || l.sort !== 'new' || l.deals || l.retailerName);
  const unknownCat = !!l.cat && !opts.categoryKnown;
  const params = new URLSearchParams();
  if (l.cat && opts.categoryKnown) params.set('cat', l.cat);
  const base = params.toString() ? `/?${params}` : '/';
  const paged = l.page > 1 ? `${base}${base.includes('?') ? '&' : '?'}page=${l.page}` : base;
  return {
    noindex: duplicate || unknownCat || !opts.hasResults,
    canonical: duplicate || unknownCat ? base : paged,
  };
}
