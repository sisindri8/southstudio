import { saveProduct } from '../actions';
import CategoryPicker from './CategoryPicker';
import MainImageField from './MainImageField';

type Props = { product?: any; cats: { id: string; name: string; parent_id?: string | null }[]; brands?: string[]; linksText?: string };
export default function ProductForm({ product: p, cats, brands = [], linksText = '' }: Props) {
  const specsText = Object.entries(p?.specifications ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n');
  const checked = p?.price_checked_at ? new Date(p.price_checked_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  return (
    <form action={saveProduct} className="space-y-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <input name="name" required defaultValue={p?.name} placeholder="Product name" className="field" />
      <div className="grid grid-cols-2 gap-2">
        <CategoryPicker cats={cats} value={p?.category_id} />
        <label className="col-span-2 text-sm">Brand (optional)
          <input name="brand" list="brand-list" maxLength={80} defaultValue={p?.brands?.name ?? ''} placeholder="e.g. Nike" className="field mt-1" />
          <datalist id="brand-list">{brands.map((b) => <option key={b} value={b} />)}</datalist></label>
      </div>
      <input name="short_description" defaultValue={p?.short_description ?? ''} placeholder="Short description (shown in search results)" className="field" />
      <textarea name="description" rows={4} defaultValue={p?.description ?? ''} placeholder="Full description" className="field" />
      <label className="block text-sm">Specifications: one per line as “Label: value”
        <textarea name="specs" rows={4} defaultValue={specsText} placeholder={'Material: Cotton\nFit: Regular\nColour: Navy'} className="field mt-1" /></label>
      <div className="grid grid-cols-3 gap-2">
        <input name="price" type="number" step="0.01" min="0" defaultValue={p?.price ?? ''} placeholder="Price" className="field" />
        <input name="original_price" type="number" step="0.01" min="0" defaultValue={p?.original_price ?? ''} placeholder="Original price" className="field" />
        <input name="currency" defaultValue={p?.currency ?? 'INR'} maxLength={3} className="field" />
      </div>
      {p && <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="price_checked" /> I re-checked this price at the retailer today{checked && <span className="text-ink/60"> (last checked {checked})</span>}</label>}
      <MainImageField current={p?.main_image_url} />
      {!!p?.product_images?.length && (
        <div className="flex flex-wrap gap-3 text-xs">
          {p.product_images.map((i: any) => (
            <label key={i.id}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={i.url} alt="" className="h-16" />
              <input type="checkbox" name="remove_image" value={i.id} /> Remove</label>
          ))}
        </div>
      )}
      <label className="block text-sm">Add gallery images<input name="gallery" type="file" multiple accept="image/jpeg,image/png,image/webp" className="field" /></label>
      <label className="block text-sm">Buy links: paste one link per line. Buttons like “Buy now on Amazon” are created automatically.
        <textarea name="links" rows={4} defaultValue={linksText} placeholder={'https://amzn.to/...\nhttps://fkrt.it/...'} className="field" /></label>
      <fieldset className="space-y-2 border border-line p-3"><legend className="px-1 text-sm font-semibold">Search engine listing (optional)</legend>
        <input name="seo_title" maxLength={70} defaultValue={p?.seo_title ?? ''} placeholder="SEO title (up to 70 characters; defaults to the product name)" className="field" />
        <textarea name="seo_description" rows={2} maxLength={200} defaultValue={p?.seo_description ?? ''} placeholder="SEO description (about 150 characters; defaults to the short description)" className="field" />
      </fieldset>
      <div className="flex items-center gap-4 text-sm">
        <select name="status" defaultValue={p?.status ?? 'draft'} className="field w-auto"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select>
        <label><input type="checkbox" name="featured" defaultChecked={p?.featured} /> Featured</label>
        <label><input type="checkbox" name="trending" defaultChecked={p?.trending} /> Trending</label>
      </div>
      <button className="btn">{p ? 'Save changes' : 'Save product'}</button>
    </form>
  );
}
