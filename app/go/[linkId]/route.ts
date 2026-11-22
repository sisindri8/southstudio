import { resolveLink } from '@/lib/linkstore';
import { clickQueue } from '@/lib/clicks';
import { clientIp, rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT = /bot|crawl|spider|slurp|preview|fetch|monitor|curl|wget|python|axios|headless|facebookexternalhit|embedly|whatsapp|telegram|discord|lighthouse/i;
// The redirect must never be cached by a browser or by Cloudflare: every click has to reach us (and count).
const BASE = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow' };
const plain = (status: number, body: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { ...BASE, 'Content-Type': 'text/plain; charset=utf-8', ...extra } });

export async function GET(req: Request, { params }: { params: { linkId: string } }) {
  if (!UUID.test(params.linkId)) return plain(404, 'Not found');
  const r = await resolveLink(params.linkId);
  if (r.status === 'missing' || r.status === 'blocked') return plain(404, 'Not found');
  if (r.status === 'error') return plain(503, 'This link is temporarily unavailable. Please try again in a moment.', { 'Retry-After': '5' });

  // Count real visitors only. This never delays or blocks the redirect: it only appends to an in-memory buffer.
  const ua = req.headers.get('user-agent') || '';
  if (req.method === 'GET' && ua && !BOT.test(ua) && rateLimit('go-count', clientIp(req.headers), 120, 60_000).ok) {
    clickQueue().record({
      link_id: r.link.id, product_id: r.link.productId, retailer_id: r.link.retailerId,
      referrer: req.headers.get('referer')?.slice(0, 300) ?? null,
    });
  }
  // 302 + the stored URL exactly as validated (all affiliate tag / tracking parameters are preserved).
  return new Response(null, { status: 302, headers: { ...BASE, Location: r.link.href } });
}
