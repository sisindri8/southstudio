// Optimise images that were uploaded BEFORE the WebP pipeline existed (optional, run by you, from your computer).
//
//   npm run backfill:images                 DRY RUN (default): downloads, measures, prints a report. Changes NOTHING.
//   npm run backfill:images -- --apply      uploads the 3 WebP sizes and repoints the database rows to them.
//   options: --limit 20   process only the first 20 distinct images (try a few first)
//
// Safety: original files are NEVER deleted or modified (so every change is reversible: see backfill-report.json, which lists
// old -> new URL for each row). Only images stored in YOUR Supabase bucket are touched. Each image is downloaded once.
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (e.g. `set -a; . ./.env.local; set +a`).
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { processImage, uploadBuffer } from '../lib/images';

const apply = process.argv.includes('--apply');
const li = process.argv.indexOf('--limit'); const limit = li > 0 ? Number(process.argv[li + 1]) : Infinity;
const url0 = process.env.NEXT_PUBLIC_SUPABASE_URL, key0 = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
if (!url0 || !key0) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.'); process.exit(1); }
async function main() {
const url = url0 as string, key = key0 as string;
const db = createClient(url, key, { auth: { persistSession: false } });
const OURS = `${url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/`;
const done = (u: string) => /\/optimized\/[0-9a-f-]{36}\/(sm|md|lg)\.webp/i.test(u);
const targets = [{ table: 'products', col: 'main_image_url' }, { table: 'product_images', col: 'url' }, { table: 'categories', col: 'image_url' }];

type Row = { table: string; col: string; id: string; url: string };
const rows: Row[] = [];
for (const t of targets) {
  const { data, error } = await db.from(t.table).select(`id,${t.col}`).not(t.col, 'is', null).limit(20000);
  if (error) { console.error(`Could not read ${t.table}: ${error.message}`); process.exit(1); }
  for (const r of (data ?? []) as any[]) { const u = r[t.col] as string; if (u?.startsWith(OURS) && !done(u)) rows.push({ ...t, id: r.id, url: u }); }
}
const distinct = [...new Set(rows.map((r) => r.url))].slice(0, limit);
console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${rows.length} database rows use ${distinct.length} distinct un-optimised images in "${bucket}".`);

const map: Record<string, string> = {}; let before = 0, after = 0, failed = 0;
for (const [i, u] of distinct.entries()) {
  try {
    const res = await fetch(u); if (!res.ok) throw new Error(`download ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer()); before += buf.length;
    const { variants } = await processImage(buf);
    const card = variants[0].buf.length; after += card;
    console.log(`  [${i + 1}/${distinct.length}] ${(buf.length / 1e6).toFixed(2)} MB -> sm ${(variants[0].buf.length / 1e3).toFixed(0)} KB / md ${(variants[1].buf.length / 1e3).toFixed(0)} KB / lg ${(variants[2].buf.length / 1e3).toFixed(0)} KB   ${u.slice(OURS.length)}`);
    if (apply) map[u] = await uploadBuffer(db, bucket, buf, '', res.headers.get('content-type') || 'image/jpeg');
  } catch (e) { failed++; console.warn(`  SKIPPED ${u.slice(OURS.length)}: ${(e as Error).message}`); }
}
console.log(`Original total ${(before / 1e6).toFixed(1)} MB; a product card would now download ${(after / 1e6).toFixed(2)} MB for the same images.${failed ? ` ${failed} skipped (left untouched).` : ''}`);
if (apply) {
  const report: Row[] & { newUrl?: string }[] = [];
  for (const r of rows) {
    const nu = map[r.url]; if (!nu) continue;
    const { error } = await db.from(r.table).update({ [r.col]: nu }).eq('id', r.id);
    if (error) console.warn(`  could not update ${r.table}/${r.id}: ${error.message}`); else report.push({ ...r, newUrl: nu } as any);
  }
  writeFileSync('backfill-report.json', JSON.stringify(report, null, 2));
  console.log(`Updated ${report.length} rows. Originals were NOT deleted. Rollback list: backfill-report.json (oldUrl is in the "url" field).`);
} else console.log('Nothing was changed. Re-run with --apply to proceed.');
}
main().catch((e) => { console.error(e); process.exit(1); });
