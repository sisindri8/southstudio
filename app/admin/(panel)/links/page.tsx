import Link from 'next/link';
import { admin, requireAdmin } from '@/lib/supabase';
import { linkState, type LinkState } from '@/lib/linkcheck';
import { checkLinks } from '../actions';
import ErrorBanner from '../ErrorBanner';

export const dynamic = 'force-dynamic';
const BADGE: Record<LinkState, [string, string]> = {
  ok: ['Working', 'bg-lime'], dead: ['Broken', 'bg-flare text-white'], blocked: ['Blocked / unknown', 'bg-chalk'],
  error: ['Could not reach', 'bg-chalk'], unchecked: ['Not checked', 'bg-chalk'],
};

export default async function Links({ searchParams }: { searchParams: { err?: string; done?: string } }) {
  await requireAdmin();
  const { data, error } = await admin().from('product_affiliate_links')
    .select('id,affiliate_url,last_status,last_error,last_checked_at,product_id,retailers(name),products(name,status)')
    .order('last_checked_at', { ascending: true, nullsFirst: true }).limit(500);
  const rows: any[] = data ?? [];
  const states = rows.map((r) => linkState(r.last_status, r.last_error, r.last_checked_at));
  const count = (s: LinkState) => states.filter((x) => x === s).length;
  return (
    <div className="max-w-4xl space-y-4 border border-line bg-white p-5 sm:p-6">
      <h1 className="font-display text-3xl font-extrabold uppercase">Link checker</h1>
      <ErrorBanner message={searchParams.err ?? (error ? `${error.message}. Run supabase/migrations/0004_features.sql.` : undefined)} />
      {searchParams.done && <p role="status" className="bg-lime p-2 text-sm">Check finished.</p>}
      <p className="text-sm text-ink/70">Each click checks the 40 least recently checked links. Big retailers such as Amazon and Flipkart often block automated checks, so “Blocked / unknown” does not mean the link is broken. Only “Broken” (404, 410 or a dead domain) needs fixing.</p>
      <form action={checkLinks}><button className="btn">Check next 40 links</button></form>
      <p className="text-sm">Working: <strong>{count('ok')}</strong> · Broken: <strong className={count('dead') ? 'text-flare' : ''}>{count('dead')}</strong> · Blocked/unknown: <strong>{count('blocked') + count('error')}</strong> · Not checked: <strong>{count('unchecked')}</strong></p>
      <ul className="divide-y divide-line border border-line">
        {rows.map((r, i) => { const [label, cls] = BADGE[states[i]]; return (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span className="min-w-0 flex-1">
              <Link href={`/admin/products/${r.product_id}`} className="font-medium underline">{r.products?.name}</Link>
              <span className="text-ink/60"> · {r.retailers?.name}{r.products?.status !== 'published' && ` · ${r.products?.status}`}</span><br />
              <a href={r.affiliate_url} target="_blank" rel="noopener noreferrer nofollow" className="block max-w-full truncate text-xs text-ink/60 underline">{r.affiliate_url}</a>
            </span>
            <span className="text-right text-xs">
              <span className={`inline-block px-2 py-0.5 font-semibold ${cls}`}>{label}{r.last_status ? ` (${r.last_status})` : ''}</span>
              {r.last_checked_at && <><br />{new Date(r.last_checked_at).toLocaleString('en-IN')}</>}
              {r.last_error && <><br /><span className="text-ink/60">{r.last_error}</span></>}
            </span>
          </li>); })}
        {!rows.length && <li className="p-3 text-sm text-ink/60">No links yet.</li>}
      </ul>
    </div>
  );
}
