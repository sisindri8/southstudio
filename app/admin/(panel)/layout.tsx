import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin, sb } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
async function logout() { 'use server'; await sb().auth.signOut(); redirect('/admin/login'); }
export default async function Panel({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex gap-4 border-b border-line pb-3 text-sm">
        <Link href="/admin/products">Products</Link>
        <Link href="/admin/categories">Categories</Link>
        <Link href="/admin/messages">Messages</Link>
        <Link href="/admin/subscribers">Email list</Link>
        <Link href="/admin/analytics">Analytics</Link>
        <Link href="/admin/links">Link checker</Link>
        <Link href="/admin/settings">Site settings</Link>
        <Link href="/admin/setup">Setup check</Link>
        <form action={logout} className="ml-auto"><button>Sign out</button></form>
      </nav>
      {children}
    </div>
  );
}
