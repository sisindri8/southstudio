'use client';
import { useEffect, useRef, useState } from 'react';

declare global { interface Window { adsbygoogle?: unknown[] } }

// One horizontal banner. Google's "advanced responsive" code: full width up to 970 px with a fixed 100 px height, so only
// horizontal sizes fit (320x50, 320x100, 468x60, 728x90, 970x90), on phones as well as desktop. The unit must be created
// in AdSense as a Display ad with size "Responsive".
export default function AdSlot({ client, slot, compact = false }: { client: string; slot: string; compact?: boolean }) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!pushed.current && !el.getAttribute('data-adsbygoogle-status')) {
      pushed.current = true;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    }
    // Collapse the whole block (label included) when Google has no ad to show.
    const mo = new MutationObserver(() => { if (el.getAttribute('data-ad-status') === 'unfilled') setHidden(true); });
    mo.observe(el, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => mo.disconnect();
  }, []);
  return (
    <aside aria-label="Advertisement" hidden={hidden} className={compact ? 'mt-6' : 'mx-auto my-12 max-w-[970px] px-4'}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-ink/40">Advertisement</p>
      <ins ref={ref} className="adsbygoogle" style={{ display: 'block', width: '100%', maxWidth: 970, height: 100 }} data-ad-client={client} data-ad-slot={slot} />
    </aside>
  );
}
