import { admin, requireAdmin } from '@/lib/supabase';
import { deleteCategory, saveCategory } from '../actions';
import ConfirmButton from '../ConfirmButton';
import ErrorBanner from '../ErrorBanner';

function Row({ c, main }: { c: any; main?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={saveCategory} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={c.id} />
        {c.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.image_url} alt="" className="h-10 w-8 object-cover" />}
        <input name="name" defaultValue={c.name} required className="field w-40" aria-label="Name" />
        <input name="sort_order" type="number" defaultValue={c.sort_order} className="field w-16" aria-label="Order" title="Order (small numbers first)" />
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="w-44 text-xs" aria-label="Photo" />
        {c.image_url && <label className="text-xs"><input type="checkbox" name="image_remove" /> Remove photo</label>}
        <button className="btn">Save</button>
      </form>
      <form action={deleteCategory}><input type="hidden" name="id" value={c.id} /><ConfirmButton className="text-sm text-flare" message={main ? `Delete “${c.name}” AND all its sub categories? Products in them will become uncategorised.` : `Delete “${c.name}”? Products in it will become uncategorised.`}>Delete</ConfirmButton></form>
    </div>
  );
}
export default async function Categories({ searchParams }: { searchParams: { err?: string } }) {
  await requireAdmin();
  const { data, error } = await admin().from('categories').select('id,name,slug,parent_id,sort_order,image_url').order('sort_order').order('name');
  const all: any[] = data ?? [];
  const parents = all.filter((c) => !c.parent_id);
  return (
    <div className="max-w-3xl space-y-8 border border-line bg-white p-5 sm:p-6">
      <h1 className="font-display text-3xl font-extrabold uppercase">Categories</h1>
      <ErrorBanner message={searchParams.err} />
      {error && <p role="alert" className="bg-flare p-2 text-sm text-white">Could not load categories: {error.message}. Run supabase/migrations/0002_categories.sql in the Supabase SQL Editor, then see Setup check.</p>}
      <p className="text-sm text-ink/70">Main categories appear in the menu and as the slanted photos on the homepage (upload a photo for each: 900×1200 px portrait, subject in the middle, bottom empty for the name). Sub categories appear in the dropdown under their main category.</p>
      {parents.map((p) => (
        <section key={p.id} className="space-y-3 border border-line p-4">
          <Row c={p} main />
          <div className="ml-6 space-y-2">
            <p className="text-xs font-semibold uppercase text-ink/60">Sub categories</p>
            {all.filter((c) => c.parent_id === p.id).map((k) => <Row key={k.id} c={k} />)}
            <form action={saveCategory} className="flex items-center gap-2">
              <input type="hidden" name="parent_id" value={p.id} />
              <input name="name" required placeholder={`Add sub category under ${p.name}`} className="field w-64" />
              <input name="sort_order" type="number" defaultValue={0} className="field w-16" aria-label="Order" />
              <button className="btn">Add sub category</button>
            </form>
          </div>
        </section>
      ))}
      <form action={saveCategory} className="flex items-center gap-2 border-t border-line pt-6">
        <input name="name" required placeholder="New main category" className="field w-56" />
        <input name="sort_order" type="number" defaultValue={0} className="field w-16" aria-label="Order" />
        <button className="btn">Add main category</button>
      </form>
    </div>
  );
}
