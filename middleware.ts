import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clientIp, rateLimit, tooMany } from '@/lib/ratelimit';

// 1) /admin/*: refreshes the Supabase session cookie and keeps signed-out visitors out.
//    Admin-ness itself (admin_profiles) is enforced server-side by requireAdmin() in every admin page and action.
// 2) Public guards (cheap, in-memory; see lib/ratelimit.ts for the limits of in-memory limiting):
//      /?q=...           search: 30 per minute per IP  -> HTTP 429
//      /auth/*           sign-in callbacks: 20 per minute per IP
//      server-action POSTs outside /admin (contact, subscribe, hearts): body must be < 64 KB, 60 per minute per IP
//    Admin uploads (up to ~35 MB) are exempt from the size cap because they are inside /admin and need a signed-in admin.
const MAX_PUBLIC_POST = 64 * 1024;

async function adminGate(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const s = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await s.auth.getUser();
  if (!user && req.nextUrl.pathname !== '/admin/login') {
    const url = req.nextUrl.clone(); url.pathname = '/admin/login'; url.search = '';
    const redirect = NextResponse.redirect(url);
    res.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith('/admin')) return adminGate(req);
  const ip = clientIp(req.headers);
  if (path === '/' && req.nextUrl.searchParams.has('q')) {
    const r = rateLimit('search', ip, 30, 60_000); if (!r.ok) return tooMany(r.retryAfter, 'Too many searches. Please wait a moment and try again.');
  } else if (path.startsWith('/auth/')) {
    const r = rateLimit('auth', ip, 20, 60_000); if (!r.ok) return tooMany(r.retryAfter);
  } else if (req.headers.has('next-action')) {
    const len = Number(req.headers.get('content-length') || 0);
    if (len > MAX_PUBLIC_POST) return new Response('Request too large', { status: 413, headers: { 'Cache-Control': 'no-store' } });
    const r = rateLimit('actions', ip, 60, 60_000); if (!r.ok) return tooMany(r.retryAfter);
  }
  return NextResponse.next();
}
export const config = {
  matcher: [
    '/admin/:path*',
    { source: '/', has: [{ type: 'query', key: 'q' }] },
    '/auth/:path*',
    { source: '/((?!admin|_next|api|go).*)', has: [{ type: 'header', key: 'next-action' }] },
  ],
};
