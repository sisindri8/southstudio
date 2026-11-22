'use client';
import { useState } from 'react';
import Link from 'next/link';
import OptImage from '../../OptImage';

type L = { id: string; name: string; bg: string; fg: string; price: string | null };
type D = { name: string; category: string | null; brand: string | null; priceChecked: string | null; priceStale: boolean; price: string | null; original: string | null; discount: number | null;
  description: string; specs: [string, string][]; images: string[]; links: L[] };

const fade = 'motion-safe:animate-fade-in';

// Layout: text panel on the left; big photo, thumbnails and the ad slot on the right (stacked above the text on phones).
export default function ProductView({ data: d, ad }: { data: D; ad?: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [note, setNote] = useState('');
  const n = d.images.length;
  const linkProps = { target: '_blank', rel: 'nofollow sponsored noopener' };

  // Share: the phone's share sheet where available, otherwise copy the page link.
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: d.name, url }); return; }
      await navigator.clipboard.writeText(url);
      setNote('Link copied');
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // the person closed the share sheet
      setNote('Could not copy the link');
    }
    setTimeout(() => setNote(''), 2200);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:py-14">
      {/* ---------- Details ---------- */}
      <div className="min-w-0">
        <div className="bg-[#FAFAF8] p-5 sm:p-7">
          <Link href="/" className="text-xs uppercase tracking-widest text-ink/60 hover:text-flare">← Back to shop</Link>
          {(d.brand || d.category) && <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-ink/50">{[d.brand, d.category].filter(Boolean).join(' · ')}</p>}
          <h1 className={`mt-2 break-words font-cond text-5xl uppercase leading-[0.95] sm:text-6xl lg:text-7xl ${fade}`}>{d.name}</h1>
          {d.price && (
            <p className={`mt-6 flex flex-wrap items-baseline gap-3 ${fade}`} style={{ animationDelay: '80ms' }}>
              <span className="text-4xl font-light">{d.price}</span>
              {d.original && <s className="text-lg text-ink/40">{d.original}</s>}
              {d.discount != null && d.discount > 0 && <span className="bg-flare px-2 py-0.5 text-xs font-bold text-white">{d.discount}% OFF</span>}
            </p>
          )}
          {d.price && d.priceChecked && <p className="mt-1 text-xs text-ink/55">Price checked on {d.priceChecked}{d.priceStale && ' · this may be out of date, please confirm on the retailer’s site'}</p>}
          {d.description && <p className={`mt-6 max-w-lg whitespace-pre-line text-base leading-relaxed text-ink/75 sm:text-lg ${fade}`} style={{ animationDelay: '160ms' }}>{d.description}</p>}
          {d.specs.length > 0 && (
            <dl className="mt-5 max-w-md text-sm">
              {d.specs.map(([k, v]) => <div key={k} className="flex gap-3 border-b border-line py-1"><dt className="w-32 shrink-0 text-ink/50">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          )}

          <h2 className="mt-10 text-xs font-bold uppercase tracking-widest">Available at</h2>
          {d.links.length ? (
            <ul className="mt-3 flex flex-wrap gap-3">
              {d.links.map((l) => (
                <li key={l.id}>
                  <a href={`/go/${l.id}`} {...linkProps} style={{ backgroundColor: l.bg, color: l.fg }}
                     className="inline-flex rounded-full px-5 py-3 text-xs font-extrabold uppercase tracking-wider transition hover:-translate-y-0.5 motion-reduce:transition-none">
                    Buy now on {l.name}{l.price ? ` · ${l.price}` : ''}
                  </a>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-ink/60">No retailer links are available right now.</p>}
        </div>

        <p className="bg-[#FAFAF8]/70 p-4 text-xs leading-relaxed text-ink/55 sm:px-7">
          Affiliate disclosure: we may earn a commission if you buy through these links, at no extra cost to you. Prices are entered by us and may change at the retailer.{d.links.some((l) => l.name === 'Amazon') && ' As an Amazon Associate I earn from qualifying purchases.'}
        </p>
      </div>

      {/* ---------- Photos and ad ---------- */}
      <div className="order-first min-w-0 lg:order-none">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-line bg-[#F4F4F2]">
          {n > 0
            // multiply blends a white photo background into the card colour
            ? <OptImage key={i} src={d.images[i]} alt={`${d.name}, image ${i + 1} of ${n}`} priority={i === 0} width={1120} height={1400}
                sizes="(min-width: 1024px) 520px, 100vw" className={`h-full w-full object-contain mix-blend-multiply ${fade}`} />
            : <div aria-hidden className="flex h-full w-full items-center justify-center text-xs uppercase tracking-widest text-ink/30">No image</div>}
          <button type="button" onClick={share} aria-label="Share this product" title="Share"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white hover:text-flare">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15V3" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
          </button>
          {note && <p role="status" className="absolute right-3 top-14 rounded bg-ink px-2 py-1 text-xs text-white">{note}</p>}
        </div>

        {n > 1 && (
          <ul className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {d.images.map((u, k) => (
              <li key={k} className="w-[22%] min-w-[72px] shrink-0">
                <button type="button" onClick={() => setI(k)} aria-label={`Show image ${k + 1}`} aria-current={k === i ? 'true' : undefined}
                  className={`block aspect-[3/4] w-full overflow-hidden border bg-[#F4F4F2] transition motion-reduce:transition-none ${k === i ? 'border-ink ring-1 ring-ink' : 'border-line opacity-75 hover:opacity-100'}`}>
                  <OptImage src={u} alt="" sizes="120px" width={120} height={160} className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {ad}
      </div>
    </div>
  );
}
