import { NextResponse } from 'next/server';
import { pubFresh } from '@/lib/public';
import { clientIp, rateLimit, tooMany } from '@/lib/ratelimit';
import { clickQueue } from '@/lib/clicks';

export const dynamic = 'force-dynamic';
const H = { 'Cache-Control': 'no-store' };
// Readiness: one tiny read-only query. Point UptimeRobot here (every 5 min). It also counts as database activity,
// which stops Supabase Free from pausing the project after 7 idle days. Do NOT use it as Render's healthCheckPath.
export async function GET(req: Request) {
  const rl = rateLimit('health-db', clientIp(req.headers), 30, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const { error } = await pubFresh(3000).from('retailers').select('id').limit(1);
  const c = clickQueue().stats();
  const body = { ok: !error, db: !error, clicks: { pending: c.pending, lost: c.lost, dropped: c.dropped } };
  return NextResponse.json(body, { status: error ? 503 : 200, headers: H });
}
