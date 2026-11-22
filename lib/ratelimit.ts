// Small in-memory rate limiter (fixed window, per key). Works in the Node AND Edge runtimes (no Node APIs).
//
// HONEST LIMITS (also in docs/SECURITY.md):
//  * State lives in this one process. It is NOT shared between instances and is wiped on every restart,
//    deploy and Render Free spin-down. With one instance that is acceptable; with 2+ instances each has its own counters.
//  * Next's middleware runs in a separate sandbox from route handlers, so a bucket used in both has two counters.
//    Each bucket in this app is used in one place only.
//  * The client IP comes from request headers. Behind Cloudflare set TRUST_CF_CONNECTING_IP=1 so CF-Connecting-IP is used.
//    Anyone who can reach the origin directly (xxx.onrender.com) can forge headers, so treat this as abuse
//    mitigation, not a security boundary. Cloudflare's edge rate limiting is the real first line of defence.
type Slot = { n: number; reset: number };
const g = globalThis as unknown as { __rl?: Map<string, Slot>; __rlSweep?: number };
const store = (g.__rl ||= new Map<string, Slot>());
const MAX_KEYS = 20_000;

export type Limit = { ok: boolean; remaining: number; retryAfter: number };

export function rateLimit(bucket: string, key: string, max: number, windowMs: number, now = Date.now()): Limit {
  if (store.size > 2000 && now - (g.__rlSweep ?? 0) > 30_000) {
    g.__rlSweep = now;
    for (const [k, v] of store) if (v.reset <= now) store.delete(k);
  }
  const id = `${bucket}|${key}`;
  let s = store.get(id);
  if (!s || s.reset <= now) {
    if (!s && store.size >= MAX_KEYS) { // memory guard under a flood of distinct keys: evict the oldest entry
      const first = store.keys().next().value;
      if (first !== undefined) store.delete(first);
    }
    s = { n: 0, reset: now + windowMs };
    store.set(id, s);
  }
  s.n++;
  return { ok: s.n <= max, remaining: Math.max(0, max - s.n), retryAfter: Math.max(1, Math.ceil((s.reset - now) / 1000)) };
}

export function clientIp(h: Headers): string {
  if (process.env.TRUST_CF_CONNECTING_IP === '1') {
    const cf = h.get('cf-connecting-ip');
    if (cf) return cf.trim().slice(0, 64);
  }
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim().slice(0, 64) || 'unknown';
  return h.get('x-real-ip')?.trim().slice(0, 64) || 'unknown';
}

export const tooMany = (retryAfter: number, body = 'Too many requests. Please slow down and try again shortly.') =>
  new Response(body, { status: 429, headers: { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });

// test helper
export const _resetRateLimits = () => store.clear();
