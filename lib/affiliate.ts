// Validation of affiliate destination URLs. Used (1) when an admin saves a product and (2) on every /go redirect.
//
// Why: /go/<uuid> only ever redirects to a URL an admin typed in, so a visitor cannot choose the destination.
// This is defence in depth: a mistyped, compromised or copy-pasted link must not be able to send visitors to an
// arbitrary site, a javascript: URL, or an internal address.
//
// Policy (env AFFILIATE_HOST_POLICY):  enforce (default) = unknown hosts are refused
//                                      warn    = unknown hosts are allowed but logged
//                                      off     = only protocol/credential/IP checks
// Add merchants with AFFILIATE_EXTRA_HOSTS="lenskart.com,firstcry.com" (comma separated, subdomains included).
export const DEFAULT_HOSTS = [
  'amazon.in', 'amazon.com', 'amzn.to', 'amzn.in', 'a.co',
  'flipkart.com', 'fkrt.it', 'fkrt.cc', 'myntra.com', 'ajio.com', 'meesho.com',
  'nykaa.com', 'nykaafashion.com', 'decathlon.in', 'decathlon.com', 'snapdeal.com', 'tatacliq.com', 'croma.com',
  'nike.com', 'adidas.co.in', 'adidas.com', 'puma.com',
  // affiliate networks / link managers
  'earnkaro.com', 'cuelinks.com', 'linksredirect.com', 'bitli.in', 'linkpop.com',
];

export type UrlCheck = { ok: true; href: string; host: string } | { ok: false; reason: string; host?: string };
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export const allowedHosts = (): string[] => [
  ...DEFAULT_HOSTS,
  ...(process.env.AFFILIATE_EXTRA_HOSTS || '').split(',').map((h) => h.trim().toLowerCase().replace(/^\.|\/.*$/g, '')).filter(Boolean),
];
const policy = () => (['enforce', 'warn', 'off'].includes(process.env.AFFILIATE_HOST_POLICY || '') ? process.env.AFFILIATE_HOST_POLICY! : 'enforce');
export const hostAllowed = (host: string) => allowedHosts().some((d) => host === d || host.endsWith(`.${d}`));

export function checkAffiliateUrl(raw: unknown): UrlCheck {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, reason: 'empty' };
  if (raw.length > 2048) return { ok: false, reason: 'too long' };
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return { ok: false, reason: 'not a valid URL' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, reason: `protocol ${u.protocol} is not allowed` };
  if (u.username || u.password) return { ok: false, reason: 'URLs with embedded credentials are not allowed' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || IPV4.test(host) || host.includes(':') || host.startsWith('[') || /^(localhost|.*\.local|.*\.internal)$/.test(host))
    return { ok: false, reason: 'IP addresses, localhost and internal hosts are not allowed', host };
  if (policy() !== 'off' && !hostAllowed(host)) {
    if (policy() === 'enforce') return { ok: false, reason: `${host} is not an approved merchant domain`, host };
  }
  return { ok: true, href: u.href, host };
}
