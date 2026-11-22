'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { NavCat } from '@/lib/site';

// Desktop: dropdown opens on hover/focus. Touch: the ▾ button toggles it, and the category name still links to the category.
export default function Nav({ nav }: { nav: NavCat[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const onDown = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('pointerdown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);
  return (
    <nav ref={ref} aria-label="Categories" className="mx-auto mt-3 flex max-w-6xl flex-wrap justify-center gap-x-7 px-4 text-sm font-medium uppercase tracking-wide">
      <Link href="/" className="py-2 font-bold">New in</Link>
      {nav.map((c) => c.children.length ? (
        <div key={c.slug} className="group relative flex items-center py-2">
          <Link href={`/?cat=${c.slug}`} onClick={() => setOpen(null)} className="hover:text-flare">{c.name}</Link>
          <button type="button" aria-expanded={open === c.slug} aria-label={`${c.name} sub categories`} onClick={() => setOpen(open === c.slug ? null : c.slug)} className="px-1.5 hover:text-flare">▾</button>
          <ul className={`absolute left-1/2 top-full z-20 min-w-[150px] -translate-x-1/2 border-2 border-ink bg-white py-1 transition group-focus-within:visible group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:visible [@media(hover:hover)]:group-hover:opacity-100 ${open === c.slug ? 'visible opacity-100' : 'invisible opacity-0'}`}>
            <li><Link href={`/?cat=${c.slug}`} onClick={() => setOpen(null)} className="block px-4 py-2 font-bold hover:bg-lime">All {c.name}</Link></li>
            {c.children.map((k) => <li key={k.slug}><Link href={`/?cat=${k.slug}`} onClick={() => setOpen(null)} className="block px-4 py-2 hover:bg-lime">{k.name}</Link></li>)}
          </ul>
        </div>
      ) : <Link key={c.slug} href={`/?cat=${c.slug}`} className="py-2 hover:text-flare">{c.name}</Link>)}
    </nav>
  );
}
