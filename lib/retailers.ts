const KNOWN: [RegExp, string][] = [
  [/(^|\.)amazon\.|(^|\.)amzn\.|^a\.co$/, 'Amazon'],
  [/(^|\.)flipkart\.|(^|\.)fkrt\./, 'Flipkart'], [/(^|\.)myntra\./, 'Myntra'], [/(^|\.)ajio\./, 'Ajio'], [/(^|\.)meesho\./, 'Meesho'],
  [/(^|\.)nykaa(fashion)?\./, 'Nykaa'], [/(^|\.)decathlon\./, 'Decathlon'], [/(^|\.)snapdeal\./, 'Snapdeal'], [/(^|\.)tatacliq\./, 'Tata CLiQ'],
  [/(^|\.)croma\./, 'Croma'], [/(^|\.)nike\./, 'Nike'], [/(^|\.)adidas\./, 'Adidas'], [/(^|\.)puma\./, 'Puma'],
];
// Link shorteners hide the real retailer, so we can't name it from the URL.
const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'cutt.ly', 'rb.gy', 'ow.ly', 'is.gd', 'shorturl.at', 'linkpop.com', 'bitli.in', 'earnkaro.com', 'cuelinks.com']);
// Second-level suffixes such as co.in / com.au / co.uk, where the brand is the label before them.
const SLD = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'in', 'nic']);

export function retailerFromUrl(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  for (const [re, name] of KNOWN) if (re.test(host)) return name;
  if (SHORTENERS.has(host)) return 'Online store';
  const parts = host.split('.');
  let i = parts.length - 2;
  if (parts.length >= 3 && SLD.has(parts[parts.length - 2]) && parts[parts.length - 1].length <= 3) i = parts.length - 3;
  const label = parts[Math.max(i, 0)] || host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const COLORS: Record<string, [string, string]> = {
  Amazon: ['#FF9900', '#0B0B0B'], Flipkart: ['#2874F0', '#FFFFFF'], Myntra: ['#FF3F6C', '#FFFFFF'], Ajio: ['#2C4152', '#FFFFFF'],
  Meesho: ['#9F2089', '#FFFFFF'], Nykaa: ['#FC2779', '#FFFFFF'], Decathlon: ['#0082C3', '#FFFFFF'],
};
export const retailerStyle = (name: string) => { const [bg, fg] = COLORS[name] ?? ['#0B0B0B', '#FFFFFF']; return { backgroundColor: bg, color: fg }; };
