// Server-only image processing (sharp). Runs ONCE per upload in the admin action; public pages never process images.
//
//  * validates by decoding (not by trusting the browser's MIME type): only real JPEG / PNG / WebP, not animated
//  * hard limits: 5 MB file, 24 megapixels (stops "decompression bombs" from exhausting Render Free's 512 MB RAM)
//  * auto-rotates from EXIF, then STRIPS all metadata (GPS location etc.)
//  * decodes once, produces 3 WebP sizes (400 / 800 / 1400 px wide). Alpha is kept (the sticker maker makes transparent PNGs)
//  * the uploaded File object is never modified or deleted; on any failure nothing is written and the admin can retry
import sharp, { type Metadata } from 'sharp';
import { WIDTHS } from './img';
import { log } from './log';

sharp.cache(false);      // do not keep decoded images in memory between uploads
sharp.concurrency(1);    // one libvips thread: predictable memory on a 512 MB instance
export const MAX_BYTES = 5_000_000;
export const MAX_PIXELS = 24_000_000;
const OK_FORMATS = new Set(['jpeg', 'png', 'webp']);

export type Variant = { name: keyof typeof WIDTHS; buf: Buffer; width: number; height: number };
export class ImageError extends Error {}

export async function processImage(input: Buffer): Promise<{ variants: Variant[]; hasAlpha: boolean }> {
  if (!input.length) throw new ImageError('The image file is empty.');
  if (input.length > MAX_BYTES) throw new ImageError('Images must be under 5 MB.');
  const opts = { limitInputPixels: MAX_PIXELS, failOn: 'error' as const, sequentialRead: true };
  let meta: Metadata;
  try { meta = await sharp(input, opts).metadata(); }
  catch { throw new ImageError('That file is not a valid image, or it is too large in pixels (limit 24 megapixels).'); }
  if (!meta.format || !OK_FORMATS.has(meta.format)) throw new ImageError('Images must be JPG, PNG or WebP.');
  if ((meta.pages ?? 1) > 1) throw new ImageError('Animated images are not supported.');
  if (!meta.width || !meta.height || meta.width < 16 || meta.height < 16) throw new ImageError('The image is too small.');
  if (meta.width * meta.height > MAX_PIXELS) throw new ImageError('The image has too many pixels (limit 24 megapixels). Resize it and try again.');

  try {
    // Decode + orient + downscale once to the largest size, keep raw pixels, then derive the smaller sizes from that.
    const top = WIDTHS.lg;
    const { data, info } = await sharp(input, opts).rotate().toColourspace('srgb')
      .resize({ width: top, height: top * 2, fit: 'inside', withoutEnlargement: true })
      .raw().toBuffer({ resolveWithObject: true });
    const raw = { width: info.width, height: info.height, channels: info.channels };
    const variants: Variant[] = [];
    for (const name of ['sm', 'md', 'lg'] as const) {
      const w = WIDTHS[name];
      let p = sharp(data, { raw });
      if (info.width > w) p = p.resize({ width: w, height: w * 2, fit: 'inside', kernel: 'lanczos3' });
      const q = name === 'sm' ? 76 : name === 'md' ? 80 : 82;
      const out = await p.webp({ quality: q, alphaQuality: 90, effort: 4, smartSubsample: true }).toBuffer({ resolveWithObject: true });
      variants.push({ name, buf: out.data, width: out.info.width, height: out.info.height });
    }
    return { variants, hasAlpha: info.channels === 4 };
  } catch (e) {
    log.error('image.process_failed', { message: (e as Error)?.message });
    throw new ImageError('The image could not be processed. Try a different file.');
  }
}

// Processes and uploads one image; returns the public URL of the large size (what the database stores).
// Files are immutable: a fresh uuid folder per upload, so a one-year cache lifetime is safe.
export async function uploadOptimized(db: any, bucket: string, file: File, folder = ''): Promise<string> {
  return uploadBuffer(db, bucket, Buffer.from(await file.arrayBuffer()), folder, file.type);
}

export async function uploadBuffer(db: any, bucket: string, buf: Buffer, folder = '', mime = 'application/octet-stream'): Promise<string> {
  const { variants } = await processImage(buf);
  const id = crypto.randomUUID();
  const base = `${folder}optimized/${id}`;
  const done: string[] = [];
  try {
    for (const v of variants) {
      const path = `${base}/${v.name}.webp`;
      const { error } = await db.storage.from(bucket).upload(path, v.buf, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
      if (error) throw new Error(error.message);
      done.push(path);
    }
    if (process.env.KEEP_ORIGINALS === '1') { // optional safety copy; off by default because Supabase Free storage is only 1 GB
      const ext = mime.split('/')[1] || 'bin';
      await db.storage.from(bucket).upload(`${folder}originals/${id}.${ext}`, buf, { contentType: mime, cacheControl: '31536000', upsert: false });
    }
  } catch (e) {
    if (done.length) await db.storage.from(bucket).remove(done).catch(() => {}); // clean up our own partial upload only
    throw new ImageError(`Image upload failed: ${(e as Error).message}`);
  }
  return db.storage.from(bucket).getPublicUrl(`${base}/lg.webp`).data.publicUrl;
}
