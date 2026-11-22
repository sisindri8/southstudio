// Client-safe helpers for optimised images (no sharp here, this file is bundled into the browser).
// Uploads are stored as  <bucket>/optimized/<uuid>/{sm,md,lg}.webp  and the database keeps the .../lg.webp URL,
// so NO schema change is needed: the other sizes are derived by name. Older products keep their original single URL.
export const WIDTHS = { sm: 400, md: 800, lg: 1400 } as const;
const RE = /^(.*\/optimized\/[0-9a-f-]{36})\/(?:sm|md|lg)\.webp(\?.*)?$/i;

export function imageSources(url: string | null | undefined): { src: string; srcSet?: string } | null {
  if (!url) return null;
  const m = RE.exec(url);
  if (!m) return { src: url }; // legacy upload: serve as is (backward compatible)
  const q = m[2] ?? '';
  const u = (k: keyof typeof WIDTHS) => `${m[1]}/${k}.webp${q}`;
  return { src: u('md'), srcSet: `${u('sm')} ${WIDTHS.sm}w, ${u('md')} ${WIDTHS.md}w, ${u('lg')} ${WIDTHS.lg}w` };
}
// A specific size, for places that need one fixed file (e.g. Open Graph). Falls back to the original URL.
export function imageAt(url: string | null | undefined, size: keyof typeof WIDTHS): string | null {
  if (!url) return null;
  const m = RE.exec(url);
  return m ? `${m[1]}/${size}.webp${m[2] ?? ''}` : url;
}
