import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export function sb() {
  const c = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => c.getAll(),
      setAll(list) { try { list.forEach(({ name, value, options }) => c.set(name, value, options)); } catch {} },
    },
  });
}
// Service-role client: server-only, never import in client components.
export function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. Restart npm run dev after adding it.');
  if (key.startsWith('sb_publishable_')) throw new Error('SUPABASE_SERVICE_ROLE_KEY contains the PUBLISHABLE key. Use the Secret key (sb_secret_...) or the legacy service_role key.');
  if (key.startsWith('eyJ')) {
    let role = '';
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
    if (role && role !== 'service_role') throw new Error(`SUPABASE_SERVICE_ROLE_KEY contains the "${role}" key. Use the service_role key instead.`);
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}
// Speed: every admin page calls this from the layout AND the page, and each call used to cost two database round trips
// one after the other. Now: cache() = it runs once per request however many components call it, and the two checks
// run at the same time. The "self read" policy on admin_profiles only ever shows a person their own row, so
// "a row came back" means "this signed-in person is an admin". Both checks must pass.
export const requireAdmin = cache(async () => {
  const s = sb();
  const [{ data: { user } }, { data: rows }] = await Promise.all([
    s.auth.getUser(),
    s.from('admin_profiles').select('role').limit(1),
  ]);
  if (!user || !rows?.length) redirect('/admin/login');
  return user;
});
export const money = (n: number | null, cur = 'INR') => {
  if (n == null) return null;
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); }
  catch { return `${cur} ${Math.round(n)}`; } // a bad currency code must never crash a page
};
export const discount = (p: number | null, o: number | null) =>
  p != null && o != null && o > p ? Math.round((1 - p / o) * 100) : null;
