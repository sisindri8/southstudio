// The origin the browser actually used (works behind Render's proxy). Auth cookies are set on this host, so redirecting
// anywhere else (e.g. a leftover NEXT_PUBLIC_SITE_URL=localhost) would lose the session.
export function siteOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get('x-forwarded-host') || h.get('host');
  if (host) {
    const proto = h.get('x-forwarded-proto')?.split(',')[0] || (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}
