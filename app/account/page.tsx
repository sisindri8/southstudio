import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sb } from '@/lib/supabase';
import ProductCard from '../ProductCard';

export const dynamic = 'force-dynamic';
const COLS = 'id,name,slug,main_image_url,price,original_price,currency,featured,trending,discount_pct,status,categories(name),brands(name)';

async function logout() { 'use server'; await sb().auth.signOut(); redirect('/'); }
export default async function Account() {
  const s = sb();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect('/login');
  // Newest saved first. Products that were unpublished or deleted since saving are hidden by row level security / the filter.
  const { data, error } = await s.from('saved_items').select(`created_at, products(${COLS})`).eq('user_id', user.id).order('created_at', { ascending: false });
  const items: any[] = (data ?? []).map((r: any) => r.products).filter((p: any) => p && p.status === 'published');
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="font-display text-3xl uppercase">Your account</h1>
          <p className="mt-2 text-sm">Signed in as <strong>{user.email}</strong></p>
        </div>
        <form action={logout}><button className="btn">Sign out</button></form>
      </div>

      <section id="saved" aria-labelledby="saved-h" className="pt-8">
        <h2 id="saved-h" className="font-display text-2xl font-extrabold uppercase">Saved items{items.length > 0 && <span className="ml-2 text-base font-normal text-ink/50">({items.length})</span>}</h2>
        {error && <p role="alert" className="mt-4 text-flare">Your saved items could not be loaded right now. Please try again shortly.</p>}
        {!error && items.length === 0 && (
          <p className="mt-4 text-ink/70">Nothing saved yet. Tap the heart on any product to keep it here. <Link href="/" className="font-semibold underline">Browse products</Link></p>
        )}
        {items.length > 0 && (
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {items.map((p) => <li key={p.id}><ProductCard p={p} initialSaved /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
