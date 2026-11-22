'use client';
import { useState } from 'react';

type C = { id: string; name: string; parent_id?: string | null };
export default function CategoryPicker({ cats, value }: { cats: C[]; value?: string | null }) {
  const cur = cats.find((c) => c.id === value);
  const [main, setMain] = useState(cur?.parent_id ?? cur?.id ?? '');
  const [sub, setSub] = useState(cur?.parent_id ? cur.id : '');
  const mains = cats.filter((c) => !c.parent_id);
  const subs = cats.filter((c) => c.parent_id === main);
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="text-sm">Main category
        <select value={main} onChange={(e) => { setMain(e.target.value); setSub(''); }} className="field">
          <option value="">None</option>{mains.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
      <label className="text-sm">Sub category
        <select value={sub} onChange={(e) => setSub(e.target.value)} disabled={!subs.length} className="field">
          <option value="">{subs.length ? 'None (whole category)' : 'No sub categories'}</option>
          {subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
      <input type="hidden" name="category_id" value={sub || main} />
    </div>
  );
}
