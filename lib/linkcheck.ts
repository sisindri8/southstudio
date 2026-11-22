// Checks whether an affiliate URL still resolves. Big retailers often block automated requests, so a 403/429/5xx is
// reported as "blocked" (unknown), never as "dead". Only 404/410 and DNS failures count as dead.
const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i;

export async function checkUrl(url: string): Promise<{ status: number | null; error: string | null }> {
  let u: URL;
  try { u = new URL(url); } catch { return { status: null, error: 'Invalid URL' }; }
  if (!/^https?:$/.test(u.protocol) || PRIVATE.test(u.hostname)) return { status: null, error: 'Skipped (private address)' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, {
      redirect: 'follow', signal: ctl.signal, cache: 'no-store',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; StudioSouthLinkCheck/1.0)', accept: 'text/html,*/*' },
    });
    try { await r.body?.cancel(); } catch {}
    return { status: r.status, error: null };
  } catch (e: any) {
    return { status: null, error: e?.name === 'AbortError' ? 'Timed out' : String(e?.cause?.code || e?.message || 'Network error').slice(0, 120) };
  } finally { clearTimeout(t); }
}

export type LinkState = 'ok' | 'dead' | 'blocked' | 'error' | 'unchecked';
export function linkState(status: number | null, error: string | null, checkedAt: string | null): LinkState {
  if (!checkedAt) return 'unchecked';
  if (status != null) {
    if (status >= 200 && status < 400) return 'ok';
    if (status === 404 || status === 410) return 'dead';
    return 'blocked';
  }
  return /ENOTFOUND|EAI_AGAIN/i.test(error || '') ? 'dead' : 'error';
}

export async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}
