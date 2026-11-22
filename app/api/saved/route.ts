import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sb } from '@/lib/supabase';
import { clientIp, rateLimit, tooMany } from '@/lib/ratelimit';
import { headers } from 'next/headers';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'private, no-store' };

// Which products the signed-in customer has saved. Product pages are cached and shared by everyone,
// so the hearts ask for this separately in the browser instead of baking it into the page.
export async function GET() {
  const rl = rateLimit('saved', clientIp(headers()), 120, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  // No Supabase session cookie => certainly signed out: answer without any database or auth call.
  if (!cookies().getAll().some((c) => /^sb-.+-auth-token/.test(c.name))) return NextResponse.json({ signedIn: false, ids: [] }, { headers: NO_STORE });
  try {
    const s = sb();
    const { data: { user }, error: authErr } = await s.auth.getUser();
    if (!user) {
      // A rejected/expired session (4xx) really means "signed out". A failing auth SERVICE (5xx/network) does not:
      // report it as unavailable so signed-in shoppers are not wrongly sent to the login page.
      const status = Number((authErr as any)?.status ?? 0);
      if (authErr && (status >= 500 || status === 0 || /retryable/i.test(authErr.name))) {
        log.error('saved.auth_unavailable', { status });
        return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
      }
      return NextResponse.json({ signedIn: false, ids: [] }, { headers: NO_STORE });
    }
    const { data, error } = await s.from('saved_items').select('product_id').eq('user_id', user.id).limit(2000);
    if (error) { log.error('saved.read_failed', { code: error.code }); return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
    return NextResponse.json({ signedIn: true, ids: (data ?? []).map((r: any) => r.product_id) }, { headers: NO_STORE });
  } catch (e) {
    log.error('saved.failed', { message: (e as Error)?.message });
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
}
