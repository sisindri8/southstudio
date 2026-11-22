'use client';
import { useEffect, useRef } from 'react';

declare global { interface Window { turnstile?: any; __tsq?: (() => void)[] } }
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function load(cb: () => void) {
  if (window.turnstile) return cb();
  (window.__tsq ||= []).push(cb);
  if (document.querySelector('script[data-turnstile]')) return;
  const s = document.createElement('script');
  s.src = SRC; s.async = true; s.dataset.turnstile = '1';
  s.onload = () => window.__tsq?.splice(0).forEach((f) => f());
  document.head.appendChild(s);
}
export const resetTurnstile = () => { try { window.turnstile?.reset(); } catch {} };

// Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. The widget adds a hidden "cf-turnstile-response" field to the surrounding form.
export default function Turnstile() {
  const ref = useRef<HTMLDivElement>(null);
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!key) return;
    let id: string | undefined;
    load(() => { if (ref.current && window.turnstile && !ref.current.hasChildNodes()) id = window.turnstile.render(ref.current, { sitekey: key }); });
    return () => { if (id && window.turnstile) window.turnstile.remove(id); };
  }, [key]);
  return key ? <div ref={ref} className="min-h-[65px]" /> : null;
}
