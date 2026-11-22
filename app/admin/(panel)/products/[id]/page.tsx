import Link from 'next/link';
import { notFound } from 'next/navigation';
import { admin, requireAdmin } from '@/lib/supabase';
import ProductForm from '../ProductForm';
import ErrorBanner from '../../ErrorBanner';

export default async function Edit({ params, searchParams }: { params: { id: string }; searchParams: { err?: string } }) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const db = admin();
  const [{ data: p }, { data: cats }, { data: brands }] = await Promise.all([
    db.from('products').select('*, brands(name), product_images(id,url,sort_order), product_affiliate_links(affiliate_url,priority)').eq('id', params.id).maybeSingle(),
    db.from('categories').select('id,name,parent_id').order('sort_order').order('name'),
    db.from('brands').select('name').order('name'),
  ]);
  if (!p) notFound();
  const linksText = [...p.product_affiliate_links].sort((a: any, b: any) => a.priority - b.priority).map((l: any) => l.affiliate_url).join('\n');
  return (
    <div className="max-w-xl border border-line bg-white p-5 sm:p-6">
      <Link href="/admin/products" className="text-sm underline">← Back to products</Link>
      <h1 className="my-3 font-display text-3xl uppercase">Edit product</h1>
      {p.status === 'published' && <p className="mb-3 text-sm"><Link href={`/products/${p.slug}`} className="underline">View on site</Link>. Saving updates the live page right away.</p>}
      <ErrorBanner message={searchParams.err} />
      <ProductForm product={p} cats={cats ?? []} brands={(brands ?? []).map((b: any) => b.name)} linksText={linksText} />
    </div>
  );
}
