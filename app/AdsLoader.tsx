'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Loads Google's ad script once, and never on admin, sign-in, account, contact or other non-content pages.
const SKIP = /^\/(admin|login|account|auth|contact|go|api)(\/|$)/;
export default function AdsLoader({ client }: { client: string }) {
  const path = usePathname();
  useEffect(() => {
    if (SKIP.test(path) || document.querySelector('script[data-adsense]')) return;
    const s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous'; s.dataset.adsense = '1';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    document.head.appendChild(s);
  }, [path, client]);
  return null;
}
