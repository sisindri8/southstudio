// Fast, safe lookup of an affiliate link for /go. In-memory only (works on Render Free, no Redis needed).
//
//   fresh hit  -> answered from memory, zero database calls
//   miss       -> ONE read-only database call, coalesced if many visitors click the same link at once
//   DB error   -> serve the last known good URL (up to 24 h old) rather than lose a sale; otherwise 503
//   not found  -> cached briefly (30 s) so random-UUID probing cannot hammer the database
//
// Invalidation: admin saves call invalidateLinks() (same process => immediate). On a multi-instance setup the
// TTL (default 5 min) bounds how long another instance can serve an old URL.
import { checkAffiliateUrl } from './affiliate';
import { DbError, log } from './log';

export type ResolvedLink = { id: string; href: string; productId: string; retailerId: string };
export type Resolved = { status: 'ok'; link: ResolvedLink } | { status: 'missing' } | { status: 'blocked' } | { status: 'error' };
export type RawLink = { id: string; affiliate_url: string; product_id: string; retailer_id: string } | null;
export type Fetcher = (id: string) => Promise<RawLink>; // throws DbError on service problems; returns null when not found/unpublished

const TTL = () => Math.max(5, Number(process.env.LINK_CACHE_TTL_SEC) || 300) * 1000;
const NEG_TTL = 30_000, STALE_MAX = 24 * 3600_000, MAX = 2000;
type Entry = { value: Resolved; fresh: number; stale: number };
const g = globalThis as unknown as { __links?: Map<string, Entry>; __linksInflight?: Map<string, Promise<Resolved>> };
const cache = (g.__links ||= new Map<string, Entry>());
const inflight = (g.__linksInflight ||= new Map<string, Promise<Resolved>>());

export const invalidateLinks = () => { cache.clear(); };
export const linkCacheSize = () => cache.size;

async function defaultFetch(id: string): Promise<RawLink> {
  const { pubFresh } = await import('./public');
  const { data, error } = await pubFresh(3500).from('product_affiliate_links')
    .select('id,affiliate_url,product_id,retailer_id,products!inner(status)').eq('id', id).maybeSingle();
  if (error) throw new DbError('go.lookup', error);
  if (!data || (data as any).products?.status !== 'published') return null;
  return data as any;
}

function store(id: string, value: Resolved, now: number) {
  const ttl = value.status === 'ok' ? TTL() : NEG_TTL;
  cache.delete(id);
  cache.set(id, { value, fresh: now + ttl, stale: now + (value.status === 'ok' ? STALE_MAX : ttl) });
  if (cache.size > MAX) cache.delete(cache.keys().next().value as string); // least recently used goes first
}

export async function resolveLink(id: string, fetcher: Fetcher = defaultFetch, now = Date.now()): Promise<Resolved> {
  const hit = cache.get(id);
  if (hit && hit.fresh > now) { cache.delete(id); cache.set(id, hit); return hit.value; }
  const pending = inflight.get(id);
  if (pending) return pending;
  const p = (async (): Promise<Resolved> => {
    try {
      const row = await fetcher(id);
      let value: Resolved;
      if (!row) value = { status: 'missing' };
      else {
        const chk = checkAffiliateUrl(row.affiliate_url);
        if (!chk.ok) { log.error('go.url_rejected', { linkId: id, reason: chk.reason }); value = { status: 'blocked' }; }
        else value = { status: 'ok', link: { id: row.id, href: chk.href, productId: row.product_id, retailerId: row.retailer_id } };
      }
      store(id, value, now);
      return value;
    } catch (e) {
      if (hit && hit.stale > now && hit.value.status === 'ok') { log.warn('go.served_stale', { linkId: id }); return hit.value; }
      if (!(e instanceof DbError)) log.error('go.lookup_failed', { linkId: id, message: (e as Error)?.message });
      return { status: 'error' };
    } finally { inflight.delete(id); }
  })();
  inflight.set(id, p);
  return p;
}
