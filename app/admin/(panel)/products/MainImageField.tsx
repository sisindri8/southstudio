'use client';
import { useEffect, useRef, useState } from 'react';

type Opts = { tol: number; border: number; cut: boolean };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Removes a plain background: flood-fills inward from the edges while pixels stay close to the corner colour.
function removeBackground(ctx: CanvasRenderingContext2D, w: number, h: number, tol: number) {
  const im = ctx.getImageData(0, 0, w, h); const d = im.data;
  let r = 0, g = 0, b = 0, c = 0;
  for (const [x0, y0] of [[0, 0], [w - 6, 0], [0, h - 6], [w - 6, h - 6]])
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { const i = ((y0 + y) * w + x0 + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; c++; }
  r /= c; g /= c; b /= c;
  const lim = (tol * 2) ** 2;
  const seen = new Uint8Array(w * h); const stack = new Int32Array(w * h); let sp = 0;
  const push = (p: number) => {
    if (seen[p]) return;
    const i = p * 4; const dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b;
    if (dr * dr + dg * dg + db * db <= lim) { seen[p] = 1; stack[sp++] = p; }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp]; const x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w);
  }
  let removed = 0;
  for (let p = 0; p < w * h; p++) if (seen[p]) { d[p * 4 + 3] = 0; removed++; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { // soften the cut edge
    const p = y * w + x;
    if (!seen[p] && ((x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (y > 0 && seen[p - w]) || (y < h - 1 && seen[p + w]))) d[p * 4 + 3] = 150;
  }
  ctx.putImageData(im, 0, 0);
  return removed / (w * h);
}

async function buildSticker(img: HTMLImageElement, o: Opts) {
  const sc = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
  const pad = o.border + 14, side = Math.max(w, h) + pad * 2;
  const ox = Math.round((side - w) / 2), oy = Math.round((side - h) / 2);
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = side; return c; };

  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
  if (!o.cut) { roundRect(tctx, 0, 0, w, h, Math.min(w, h) * 0.06); tctx.clip(); }
  tctx.drawImage(img, 0, 0, w, h);
  const removed = o.cut ? removeBackground(tctx, w, h, o.tol) : 0;

  const subj = mk(); subj.getContext('2d')!.drawImage(tmp, ox, oy);
  const sil = mk(); const sc2 = sil.getContext('2d')!;
  sc2.drawImage(subj, 0, 0); sc2.globalCompositeOperation = 'source-in'; sc2.fillStyle = '#fff'; sc2.fillRect(0, 0, side, side);
  const ol = mk(); const oc = ol.getContext('2d')!;
  for (const rr of [o.border, o.border * 0.66, o.border * 0.33])
    for (let a = 0; a < 360; a += 15) oc.drawImage(sil, Math.cos((a * Math.PI) / 180) * rr, Math.sin((a * Math.PI) / 180) * rr);
  oc.drawImage(sil, 0, 0);
  const out = mk(); const ctx = out.getContext('2d')!;
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  ctx.drawImage(ol, 0, 0);
  ctx.shadowColor = 'transparent'; ctx.drawImage(subj, 0, 0);
  const blob: Blob | null = await new Promise((res) => out.toBlob(res, 'image/png'));
  return { blob, removed };
}

export default function MainImageField({ current }: { current?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tol, setTol] = useState(40);
  const [border, setBorder] = useState(14);
  const [cut, setCut] = useState(true);
  const [preview, setPreview] = useState('');
  const [msg, setMsg] = useState('');

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const im = new Image();
    const src = URL.createObjectURL(f);
    im.onload = () => { setImg(im); URL.revokeObjectURL(src); };
    im.onerror = () => setMsg('That file could not be read as an image.');
    im.src = src;
  }
  function clearSticker() {
    setImg(null); setPreview(''); setMsg('');
    if (inputRef.current) inputRef.current.value = '';
  }
  useEffect(() => {
    if (!img) return;
    let dead = false;
    const t = setTimeout(async () => {
      setMsg('Making sticker…');
      try {
        const { blob, removed } = await buildSticker(img, { tol, border, cut });
        if (dead || !blob) return;
        if (blob.size > 5_000_000) { setMsg('The sticker is over 5 MB. Try a smaller photo.'); return; }
        const dt = new DataTransfer(); dt.items.add(new File([blob], 'sticker.png', { type: 'image/png' }));
        if (inputRef.current) inputRef.current.files = dt.files;
        setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
        setMsg(cut && removed > 0.92 ? 'Almost everything was removed. Lower “Background removal” or turn it off.'
          : cut && removed < 0.02 ? 'No plain background was found. Try raising “Background removal”, or turn it off.'
          : 'Sticker ready. It will be saved as the main image when you click Save product.');
      } catch { if (!dead) setMsg('Could not make the sticker from this photo.'); }
    }, 150);
    return () => { dead = true; clearTimeout(t); };
  }, [img, tol, border, cut]);

  return (
    <div className="space-y-3">
      <section className="space-y-3 border border-line bg-chalk p-3">
        <h3 className="text-sm font-semibold">Sticker maker (optional)</h3>
        <p className="text-xs text-ink/60">Upload a photo. A plain background is removed and a white sticker border is added. The result becomes the main image automatically. Works best on photos with a plain or white background.</p>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} aria-label="Photo to turn into a sticker" className="field" />
        {img && (
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} /> Remove background</label>
            <label>Background removal: {tol}<input type="range" min={5} max={90} value={tol} disabled={!cut} onChange={(e) => setTol(+e.target.value)} className="w-full" /></label>
            <label>Border size: {border}<input type="range" min={4} max={30} value={border} onChange={(e) => setBorder(+e.target.value)} className="w-full" /></label>
          </div>
        )}
        {preview && (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Sticker preview" className="h-40 w-40 bg-[#e4e4de] object-contain" />
            <button type="button" onClick={clearSticker} className="text-xs underline">Clear sticker</button>
          </div>
        )}
        <p role="status" className="text-xs">{msg}</p>
      </section>
      <label className="block text-sm">Main image {current && '(upload a new one to replace)'}
        {current && /* eslint-disable-next-line @next/next/no-img-element */ <img src={current} alt="" className="my-1 h-20" />}
        <input ref={inputRef} name="main_image" type="file" accept="image/jpeg,image/png,image/webp" className="field" /></label>
    </div>
  );
}
