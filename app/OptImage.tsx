'use client';
import { useEffect, useRef, useState } from 'react';
import { imageSources } from '@/lib/img';

// Responsive <img>: the browser picks the 400/800/1400 px WebP that fits the slot (srcset + sizes) and downloads only that one.
// Below-the-fold images are lazy; set `priority` for the one or two images visible on first paint (the LCP image).
// If the file is missing or broken, a neutral placeholder is shown instead of a broken-image icon.
export default function OptImage({ src, alt, sizes, className, priority = false, width, height, fallback }: {
  src: string | null | undefined; alt: string; sizes: string; className?: string; priority?: boolean;
  width?: number; height?: number; fallback?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // An image can fail before React attaches onError (server-rendered HTML): check once after hydration.
  useEffect(() => { const el = ref.current; if (el && el.complete && el.naturalWidth === 0) setFailed(true); }, [src]);
  const s = imageSources(src);
  if (!s || failed) return <>{fallback ?? <div role="img" aria-label={alt} className={`flex items-center justify-center bg-chalk text-center text-[10px] uppercase tracking-widest text-ink/30 ${className ?? ''}`}>Image unavailable</div>}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={s.src} srcSet={s.srcSet} sizes={s.srcSet ? sizes : undefined} alt={alt} width={width} height={height}
      loading={priority ? 'eager' : 'lazy'} decoding="async" {...(priority ? { fetchPriority: 'high' as const } : {})}
      onError={() => setFailed(true)} className={className} />
  );
}
