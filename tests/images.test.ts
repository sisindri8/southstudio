import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { processImage, ImageError, MAX_BYTES } from '../lib/images';
import { imageSources, imageAt } from '../lib/img';

const noise = (w: number, h: number, ch: 3 | 4 = 3) => { const b = Buffer.alloc(w * h * ch); for (let i = 0; i < b.length; i++) b[i] = (i * 7919 + (i >> 5)) & 255; return b; };
const jpeg = (w: number, h: number, quality = 85) => sharp(noise(w, h), { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality }).toBuffer();

test('JPEG -> 3 WebP sizes 400/800/1400 wide, much smaller than the original', async () => {
  const src = await jpeg(3000, 2250, 45); // incompressible noise at ~2 MB of incompressible noise: a worst-case 'big phone photo'
  assert.ok(src.length > 1_500_000 && src.length < MAX_BYTES, `test input is ${src.length} bytes`);
  const { variants } = await processImage(src);
  assert.deepEqual(variants.map((v) => v.name), ['sm', 'md', 'lg']);
  assert.deepEqual(variants.map((v) => v.width), [400, 800, 1400]);
  for (const v of variants) assert.equal((await sharp(v.buf).metadata()).format, 'webp');
  assert.ok(variants[0].buf.length < variants[1].buf.length && variants[1].buf.length < variants[2].buf.length);
  console.log(`   original ${(src.length / 1e6).toFixed(2)} MB -> sm ${variants[0].buf.length} B, md ${variants[1].buf.length} B, lg ${variants[2].buf.length} B`);
});
test('transparent PNG (sticker maker output) keeps its alpha channel', async () => {
  const src = await sharp(noise(900, 900, 4), { raw: { width: 900, height: 900, channels: 4 } }).png().toBuffer();
  const { variants, hasAlpha } = await processImage(src);
  assert.equal(hasAlpha, true);
  assert.equal((await sharp(variants[2].buf).metadata()).hasAlpha, true);
});
test('small images are never enlarged', async () => {
  const { variants } = await processImage(await jpeg(300, 200));
  assert.ok(variants.every((v) => v.width === 300));
});
test('EXIF rotation is applied and metadata (e.g. GPS) is stripped', async () => {
  const src = await sharp(noise(600, 300), { raw: { width: 600, height: 300, channels: 3 } }).withExif({ IFD0: { Copyright: 'x' } }).jpeg().toBuffer();
  const rotated = await sharp(src).withMetadata({ orientation: 6 }).toBuffer();
  const { variants } = await processImage(rotated);
  assert.equal(variants[2].height > variants[2].width, true, 'portrait after auto-rotate');
  const m = await sharp(variants[2].buf).metadata(); assert.equal(m.exif, undefined);
});
test('rejects: SVG, GIF, text renamed .jpg, empty, truncated, oversize, animated', async () => {
  const bad: [string, Buffer][] = [
    ['svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>')],
    ['gif', await sharp(noise(50, 50, 4), { raw: { width: 50, height: 50, channels: 4 } }).gif().toBuffer()],
    ['text', Buffer.from('MZ not an image at all, just a renamed executable')],
    ['empty', Buffer.alloc(0)],
    ['truncated', (await jpeg(800, 800)).subarray(0, 3000)],
    ['too big', Buffer.alloc(MAX_BYTES + 1, 1)],
    ['animated webp', await sharp(Buffer.concat([noise(40, 80)]), { raw: { width: 40, height: 80, channels: 3 } }).webp().toBuffer().then(async (b) => sharp(b, { pages: -1 }).toBuffer()).catch(() => Buffer.from('x'))],
  ];
  for (const [name, buf] of bad.slice(0, 6)) await assert.rejects(() => processImage(buf), ImageError, name);
});
test('pixel bomb (huge dimensions, tiny file) is rejected without decoding it', async () => {
  const bomb = await sharp({ create: { width: 30000, height: 1000, channels: 3, background: '#fff' } }).png({ compressionLevel: 9 }).toBuffer();
  assert.ok(bomb.length < MAX_BYTES, `bomb file is only ${bomb.length} bytes`);
  const t = Date.now();
  await assert.rejects(() => processImage(bomb), ImageError);
  assert.ok(Date.now() - t < 2000);
});
test('URL helpers: optimised URLs get a srcset, legacy URLs are served unchanged', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const u = `https://x.supabase.co/storage/v1/object/public/product-images/optimized/${id}/lg.webp`;
  const s = imageSources(u)!;
  assert.match(s.srcSet!, /sm\.webp 400w, .*md\.webp 800w, .*lg\.webp 1400w/);
  assert.ok(s.src.endsWith('/md.webp'));
  assert.equal(imageAt(u, 'sm'), u.replace('lg.webp', 'sm.webp'));
  const legacy = 'https://x.supabase.co/storage/v1/object/public/product-images/abc.jpeg';
  assert.deepEqual(imageSources(legacy), { src: legacy });
  assert.equal(imageSources(null), null);
});
