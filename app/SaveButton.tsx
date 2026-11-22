'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toggleSaved } from './saved/actions';

// One shared list of saved product ids for the whole page, loaded once however many hearts are on screen.
// Signed-out visitors cost ZERO requests: Supabase's session cookie is readable by the browser, so we only call
// /api/saved when that cookie exists. A click always does one authoritative check, so a hidden cookie can never lock anyone out.
type Store = { loaded: boolean; verified: boolean; signedIn: boolean; ids: ReadonlySet<string> };
const EMPTY: Store = { loaded: false, verified: false, signedIn: false, ids: new Set() };
let store: Store = EMPTY;
let loading: Promise<void> | null = null;
let failedAt = 0; // after a failed request, do not retry for 30 s (stops every heart re-asking)
const listeners = new Set<() => void>();
const publish = (s: Store) => { store = s; listeners.forEach((f) => f()); };
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
const hasSessionCookie = () => typeof document !== 'undefined' && /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(document.cookie);

function ensureLoaded(authoritative = false): Promise<void> {
  if (store.loaded && (store.verified || !authoritative)) return Promise.resolve();
  if (!authoritative && !hasSessionCookie()) { publish({ loaded: true, verified: false, signedIn: false, ids: new Set() }); return Promise.resolve(); }
  if (Date.now() - failedAt < 30_000) return Promise.resolve();
  loading ||= fetch('/api/saved', { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then((d) => publish({ loaded: true, verified: true, signedIn: !!d.signedIn, ids: new Set<string>(d.ids ?? []) }))
    .catch(() => { failedAt = Date.now(); })
    .finally(() => { loading = null; });
  return loading;
}

export default function SaveButton({ productId, name, initial = false }: { productId: string; name: string; initial?: boolean }) {
  const s = useSyncExternalStore(subscribe, () => store, () => EMPTY); // server and first client render both use EMPTY: no hydration mismatch
  const router = useRouter();
  const path = usePathname() || '';
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { ensureLoaded(); }, []);
  const saved = s.loaded ? s.ids.has(productId) : initial;

  async function onClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      await ensureLoaded(true);
      if (!store.verified) { setMsg('Saved items are not available right now. Please try again shortly.'); return; }
      if (!store.signedIn) { router.push('/login'); return; }
      const before = store;
      const wantSaved = !before.ids.has(productId);
      const ids = new Set(before.ids); wantSaved ? ids.add(productId) : ids.delete(productId);
      publish({ ...before, ids }); // show the change straight away
      const r = await toggleSaved(productId).catch(() => null);
      if (!r || !r.ok) {
        publish(before); // put it back
        if (r && !r.ok && r.auth) { publish({ ...before, signedIn: false, verified: true }); router.push('/login'); return; }
        setMsg(r && !r.ok ? r.message : 'Something went wrong. Please try again.');
        return;
      }
      if (/^\/account(\/|$)/.test(path)) router.refresh(); // keep the Saved items list in step
    } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" onClick={onClick} aria-pressed={saved} disabled={busy}
        aria-label={saved ? `Remove ${name} from saved items` : `Save ${name}`}
        title={msg || (saved ? 'Remove from saved items' : 'Save this item')}
        className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center border-2 border-ink bg-white text-ink transition hover:bg-lime disabled:opacity-60">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill={saved ? '#E10600' : 'none'} stroke={saved ? '#E10600' : 'currentColor'} strokeWidth="2" strokeLinejoin="round">
          <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 4.5 6.4 4.5c2.1 0 3.6 1.1 5.6 3.2 2-2.1 3.5-3.2 5.6-3.2 3.7 0 5.5 3.9 4 7.3C19.5 16.4 12 21 12 21z" />
        </svg>
      </button>
      {msg && <span role="status" className="sr-only">{msg}</span>}
    </>
  );
}
