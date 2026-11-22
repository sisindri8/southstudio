import { admin, requireAdmin } from '@/lib/supabase';
import { headers } from 'next/headers';
import { clientIp, rateLimit, tooMany } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
// Spreadsheet apps run text starting with = + - @ as formulas, so those cells get a leading apostrophe.
const cell = (v: string) => { const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

export async function GET() {
  await requireAdmin();
  const rl = rateLimit('export', clientIp(headers()), 10, 600_000); if (!rl.ok) return tooMany(rl.retryAfter);
  const db = admin();
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) { // PostgREST returns at most 1000 rows per request
    const { data, error } = await db.from('subscribers').select('email,source,created_at').order('created_at').range(from, from + 999);
    if (error) return new Response(error.message, { status: 500 });
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const csv = ['email,source,subscribed_at', ...rows.map((r) => [cell(r.email), cell(r.source), r.created_at].join(','))].join('\n') + '\n';
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="subscribers.csv"', 'cache-control': 'no-store' } });
}
