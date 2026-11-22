import { NextResponse } from 'next/server';
import { sb } from '@/lib/supabase';
import { siteOrigin } from '@/lib/origin';

export const dynamic = 'force-dynamic';
// Customer callback: any Google account may sign in. This grants no admin access.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const site = siteOrigin(req);
  const code = searchParams.get('code');
  if (!code) return NextResponse.redirect(`${site}/login?e=1`);
  const { error } = await sb().auth.exchangeCodeForSession(code);
  return NextResponse.redirect(`${site}${error ? '/login?e=1' : '/account'}`);
}
