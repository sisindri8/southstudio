'use client';
import { useState } from 'react';
import Turnstile, { resetTurnstile } from './Turnstile';
import { subscribe, type SubResult } from './subscribe/actions';

export default function Subscribe() {
  const [res, setRes] = useState<SubResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false); // load the spam check only once someone starts typing
  return (
    <form
      onFocus={() => setArmed(true)}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        try { const r = await subscribe(new FormData(form)); setRes(r); if (r.ok) form.reset(); }
        catch { setRes({ ok: false, message: 'Something went wrong. Please try again.' }); }
        finally { setBusy(false); resetTurnstile(); }
      }}
      className="mt-6 max-w-sm space-y-2"
    >
      <p className="text-xs font-bold uppercase tracking-widest">Get the best deals by email</p>
      <div className="flex gap-2">
        <input name="email" type="email" required autoComplete="email" maxLength={200} placeholder="you@example.com" aria-label="Email address" className="field" />
        <button disabled={busy} className="btn disabled:opacity-50">{busy ? '…' : 'Join'}</button>
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex items-start gap-2 text-xs text-ink/70"><input type="checkbox" name="consent" required className="mt-0.5" /> I agree to receive occasional deal emails. I can unsubscribe any time through the contact page.</label>
      {armed && <Turnstile />}
      {res && <p role="status" className={`text-sm ${res.ok ? 'text-ink' : 'text-flare'}`}>{res.message}</p>}
    </form>
  );
}
