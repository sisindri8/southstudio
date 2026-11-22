import Link from 'next/link';
import { money, discount } from '@/lib/supabase';
import SaveButton from './SaveButton';
import OptImage from './OptImage';

// The card is a wrapper (not a single link) so the heart button is never nested inside an <a>.
export default function ProductCard({ p, initialSaved, priority = false }: { p: any; initialSaved?: boolean; priority?: boolean }) {
  const d = discount(p.price, p.original_price);
  const label = p.brands?.name || p.categories?.name;
  return (
    <div className="group relative border-2 border-ink bg-white transition hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#0B0B0B]">
      <Link href={`/products/${p.slug}`} className="block">
        <div className="relative overflow-hidden bg-chalk">
          {p.main_image_url
            ? <OptImage src={p.main_image_url} alt={p.name} width={400} height={400} priority={priority}
                sizes="(min-width: 1152px) 270px, (min-width: 768px) 24vw, 48vw"
                className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" />
            : <div aria-hidden className="flex aspect-square w-full items-center justify-center text-xs uppercase tracking-widest text-ink/30">No image</div>}
          {d != null && d > 0 && <span className="absolute left-0 top-3 bg-flare py-1 pl-2 pr-5 text-xs font-bold text-white [clip-path:polygon(0_0,100%_0,85%_100%,0_100%)]">{d}% OFF</span>}
          {(p.trending || p.featured) && <span className="absolute bottom-2 left-2 bg-lime px-2 py-0.5 text-[10px] font-bold uppercase">{p.trending ? 'Trending' : 'Featured'}</span>}
        </div>
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink/50">{label}</p>
          <p className="line-clamp-2 font-semibold leading-snug">{p.name}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-lg font-extrabold">{money(p.price, p.currency)}</span>
            {p.original_price != null && p.price != null && p.original_price > p.price && <s className="text-xs text-ink/40">{money(p.original_price, p.currency)}</s>}
          </p>
          <span className="mt-3 block border-t-2 border-ink pt-2 text-xs font-bold uppercase tracking-widest group-hover:text-flare">View deals →</span>
        </div>
      </Link>
      <SaveButton productId={p.id} name={p.name} initial={initialSaved} />
    </div>
  );
}
