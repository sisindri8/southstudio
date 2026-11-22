import Link from 'next/link';
import { admin, requireAdmin } from '@/lib/supabase';
import { deleteProduct, setStatus } from '../actions';
import ProductForm from './ProductForm';
import ConfirmButton from '../ConfirmButton';
import ErrorBanner from '../ErrorBanner';

export default async function Products({ searchParams }: { searchParams: { err?: string; q?: string } }) {
  await requireAdmin();
  const db = admin();
  const q = (searchParams.q || '').replace(/[%_,()"\\*]/g, ' ').trim().slice(0, 80);
  let pq: any = db.from('products').select('id,name,slug,status').order('created_at', { ascending: false }).limit(300);
  if (q) pq = pq.ilike('name', `%${q}%`);
  const [{ data: products }, { data: cats }, { count: clicks }, { data: brands }] = await Promise.all([
    pq,
    db.from('categories').select('id,name,parent_id').order('sort_order').order('name'),
    db.from('affiliate_clicks').select('*', { count: 'estimated', head: true }), // exact below 1000, a fast estimate after that
    db.from('brands').select('name').order('name'),
  ]);
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="border border-line bg-white p-5 sm:p-6"><h1 className="mb-4 font-display text-3xl font-extrabold uppercase">Add product</h1><ErrorBanner message={searchParams.err} /><ProductForm cats={cats ?? []} brands={(brands ?? []).map((b: any) => b.name)} /></div>
      <section className="self-start border border-line bg-white p-5 sm:p-6">
        <p className="mb-4 text-sm">Total affiliate clicks: <strong>{clicks ?? 0}</strong> · Products: <strong>{products?.length ?? 0}</strong></p>
        <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="Search products" aria-label="Search products" className="field" /><button className="btn">Search</button></form>
        <ul className="divide-y divide-line border border-line bg-white">
          {products?.map((p: any) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>{p.name} <em className="text-ink/60">({p.status})</em></span>
              <span className="flex items-center gap-3">
                <Link href={`/admin/products/${p.id}`} className="underline">Edit</Link>
                <form action={setStatus}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value={p.status === 'published' ? 'draft' : 'published'} />
                  <button className="underline">{p.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                </form>
                <form action={deleteProduct}><input type="hidden" name="id" value={p.id} /><ConfirmButton message={`Delete “${p.name}” permanently? This also removes its images and links.`} className="text-flare">Delete</ConfirmButton></form>
              </span>
            </li>
          ))}
          {!products?.length && <li className="p-3 text-sm text-ink/60">{q ? 'No products match.' : 'No products yet.'}</li>}
        </ul>
      </section>
    </div>
  );
}
