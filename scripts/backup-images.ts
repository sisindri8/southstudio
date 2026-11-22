// Copies every file in your Supabase Storage bucket to a local folder (default ./backups/images). Run from your computer.
//   npm run backup:images                     (needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment)
// Incremental: files already downloaded with the same size are skipped, so weekly runs only fetch new images.
// Read-only toward Supabase: it never uploads, changes or deletes anything there.
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
const out = process.argv[2] || 'backups/images';
if (!url || !key) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });
let got = 0, skipped = 0, bytes = 0, failed = 0;

async function walk(prefix: string): Promise<void> {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`);
    if (!data?.length) return;
    for (const e of data) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (!e.id) { await walk(path); continue; } // a folder
      const dest = join(out, path);
      if (existsSync(dest) && statSync(dest).size === (e.metadata as any)?.size) { skipped++; continue; }
      const { data: blob, error: dlErr } = await db.storage.from(bucket).download(path);
      if (dlErr || !blob) { failed++; console.warn(`  FAILED ${path}: ${dlErr?.message}`); continue; }
      mkdirSync(dirname(dest), { recursive: true }); const buf = Buffer.from(await blob.arrayBuffer()); writeFileSync(dest, buf); got++; bytes += buf.length;
    }
    if (data.length < 100) return;
  }
}
walk('').then(() => {
  console.log(`Backed up bucket "${bucket}" to ${out}: ${got} new files (${(bytes / 1e6).toFixed(1)} MB), ${skipped} unchanged${failed ? `, ${failed} FAILED` : ''}.`);
  if (failed) process.exit(2);
}).catch((e) => { console.error(e.message); process.exit(1); });
