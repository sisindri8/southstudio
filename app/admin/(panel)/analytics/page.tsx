import Link from 'next/link';
import { admin, requireAdmin } from '@/lib/supabase';
import ErrorBanner from '../ErrorBanner';

export const dynamic = 'force-dynamic';
const RANGES = [7, 30, 90];

function Table({ title, rows }: { title: string; rows: { id: string; name: string; clicks: number }[] }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest">{title}</h2>
      <ul className="divide-y divide-line border border-line text-sm">
        {rows.map((r) => <li key={r.id} className="flex justify-between gap-3 p-2"><span className="truncate">{r.name}</span><strong>{r.clicks}</strong></li>)}
        {!rows.length && <li className="p-2 text-ink/60">No clicks yet.</li>}
      </ul>
    </section>
  );
}

export default async function Analytics({ searchParams }: { searchParams: { days?: string } }) {
  await requireAdmin();
  const days = RANGES.includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const db = admin();
  const [rep, daily] = await Promise.all([db.rpc('click_report', { days }), db.rpc('click_daily', { days })]);
  const err = rep.error || daily.error;
  const all: any[] = (rep.data as any[]) ?? [];
  const num = (x: any) => Number(x) || 0;
  const products = all.filter((r) => r.kind === 'product').map((r) => ({ ...r, clicks: num(r.clicks) })).sort((a, b) => b.clicks - a.clicks).slice(0, 15);
  const retailers = all.filter((r) => r.kind === 'retailer').map((r) => ({ ...r, clicks: num(r.clicks) })).sort((a, b) => b.clicks - a.clicks);
  const series = ((daily.data as any[]) ?? []).map((d) => ({ day: String(d.day), clicks: num(d.clicks) }));
  const total = series.reduce((a, d) => a + d.clicks, 0);
  const max = Math.max(1, ...series.map((d) => d.clicks));
  return (
    <div className="max-w-4xl space-y-6 border border-line bg-white p-5 sm:p-6">
      <h1 className="font-display text-3xl font-extrabold uppercase">Click analytics</h1>
      <ErrorBanner message={err ? `${err.message}. Run supabase/migrations/0004_features.sql in the SQL editor.` : undefined} />
      <nav className="flex gap-3 text-sm">{RANGES.map((r) => <Link key={r} href={`/admin/analytics?days=${r}`} className={r === days ? 'font-bold underline' : 'underline'}>Last {r} days</Link>)}</nav>
      <p className="text-sm">Buy-button clicks in the last {days} days: <strong>{total}</strong>. Bots and link previews are not counted.</p>
      {series.length > 0 && (
        <div role="img" aria-label={`Clicks per day for the last ${days} days`} className="flex h-32 items-end gap-px border-b border-ink">
          {series.map((d) => <div key={d.day} title={`${d.day}: ${d.clicks}`} style={{ height: `${Math.max(d.clicks ? 4 : 1, (d.clicks / max) * 100)}%` }} className={`flex-1 ${d.clicks ? 'bg-flare' : 'bg-line'}`} />)}
        </div>
      )}
      <div className="grid gap-8 md:grid-cols-2">
        <Table title="Top products" rows={products} />
        <Table title="By retailer" rows={retailers} />
      </div>
    </div>
  );
}
