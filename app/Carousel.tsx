'use client';
import { useEffect, useState } from 'react';
import OptImage from './OptImage';

export type CSlide = { image?: string; title?: string; subtitle?: string; button?: string; link?: string };

export default function Carousel({ slides }: { slides: CSlide[] }) {
  const [i, setI] = useState(0);
  const n = slides.length;
  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [n]);
  const s = slides[i % n];
  const ext = /^https?:/i.test(s.link || '');
  const Tag: any = s.link ? 'a' : 'div';
  const props = s.link ? { href: s.link, 'aria-label': s.title || 'Open offer', ...(ext ? { target: '_blank', rel: 'noopener sponsored' } : {}) } : {};
  return (
    <div className="relative h-[300px] overflow-hidden rounded-2xl bg-ink sm:h-[400px]">
      <Tag {...props} className="absolute inset-0 block">
        {s.image && <OptImage key={s.image} src={s.image} alt={s.title || ''} priority={i === 0} sizes={s.title ? '(min-width: 640px) 60vw, 75vw' : '(min-width: 1152px) 1152px, 100vw'}
          className={s.title ? 'absolute inset-y-0 right-0 h-full w-3/4 object-cover sm:w-3/5' : 'absolute inset-0 h-full w-full object-cover'} />}
        {s.title && (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-transparent" />
            <div className="relative flex h-full max-w-md flex-col justify-center p-6 text-white sm:p-12">
              <h2 className="font-display text-2xl font-extrabold uppercase leading-tight sm:text-4xl">{s.title}</h2>
              {s.subtitle && <p className="mt-2 text-white/80">{s.subtitle}</p>}
              {s.button && <span className="mt-5 inline-block self-start rounded bg-white px-5 py-2 text-sm font-semibold text-ink">{s.button}</span>}
            </div>
          </>
        )}
      </Tag>
      {n > 1 && (
        <>
          <button onClick={() => setI((i + n - 1) % n)} aria-label="Previous banner" className="absolute left-3 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-white/90 text-ink">‹</button>
          <button onClick={() => setI((i + 1) % n)} aria-label="Next banner" className="absolute right-3 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-white/90 text-ink">›</button>
          <div className="absolute bottom-3 right-5 z-10 flex gap-1.5">
            {slides.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Banner ${k + 1}`} className={`h-2 w-2 rounded-full ${k === i % n ? 'bg-white' : 'bg-white/50'}`} />)}
          </div>
        </>
      )}
    </div>
  );
}
