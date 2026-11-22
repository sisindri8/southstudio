'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function GoogleButton({ callback }: { callback: string }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr('');
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}${callback}` } });
    if (error) { setErr(error.message); setBusy(false); }
  }
  return (
    <div>
      <button type="button" onClick={go} disabled={busy} className="btn w-full">{busy ? 'Opening Google…' : 'Continue with Google'}</button>
      {err && <p role="alert" className="mt-2 text-sm text-flare">{err}</p>}
    </div>
  );
}
