import { NextResponse } from 'next/server';
import { sb } from '@/lib/supabase';
import { siteOrigin } from '@/lib/origin';

export const dynamic = 'force-dynamic';
// Admin callback: signing in is not enough, the user must exist in admin_profiles.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const site = siteOrigin(req);
  const code = searchParams.get('code');
  if (!code) return NextResponse.redirect(`${site}/admin/login?e=1`);
  const s = sb();
  const { error } = await s.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${site}/admin/login?e=1`);
  const { data: { user } } = await s.auth.getUser();
  const { data: profile } = user
    ? await s.from('admin_profiles').select('role').eq('user_id', user.id).maybeSingle()
    : { data: null };
  if (!profile) { await s.auth.signOut(); return NextResponse.redirect(`${site}/admin/login?e=2`); }
  return NextResponse.redirect(`${site}/admin/products`);
}
