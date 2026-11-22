// Optional Cloudflare Turnstile. It is only active when BOTH keys are set, so a half-configured setup never blocks real visitors.
export const turnstileOn = () => !!(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export async function verifyTurnstile(token: unknown, ip?: string | null): Promise<boolean> {
  if (!turnstileOn()) return true;
  if (typeof token !== 'string' || !token) return false;
  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
    if (ip) body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return (await r.json()).success === true;
  } catch { return false; }
}
