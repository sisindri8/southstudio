import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
// Liveness only: no database call, so a Supabase outage never makes Render restart or deregister the service.
export const GET = () => NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
