import OptImage from '../OptImage';
import type { Metadata } from 'next';
import { getSite } from '@/lib/site';

export const metadata: Metadata = { title: 'Instagram' };
export default async function Instagram() {
  const site = await getSite();
  const url = site.socials.instagram;
  return (
    <section className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-14 md:grid-cols-2">
      {site.instagram.image && <OptImage src={site.instagram.image} alt="Studio South on Instagram" sizes="(min-width: 768px) 700px, 100vw" className="w-full border-2 border-ink" />}
      <div className={site.instagram.image ? '' : 'md:col-span-2 text-center'}>
        {site.instagram.logo && <OptImage src={site.instagram.logo} alt="Partner logos" sizes="(min-width: 768px) 576px, 100vw" className="mb-6 h-auto w-full max-w-xl" />}
        <h1 className={site.instagram.logo ? 'sr-only' : 'font-display text-3xl font-extrabold uppercase sm:text-5xl'}>{site.instagram.title || 'Follow us on Instagram'}</h1>
        {(site.instagram.text || site.instagram.logo) && <p className="mt-4 text-xl font-semibold text-ink/80">{site.instagram.text || 'Discover new finds, curated by hand.'}</p>}
        {url
          ? <a href={url} target="_blank" rel="noopener" className="mt-8 inline-block bg-flare px-8 py-4 text-sm font-bold uppercase tracking-wider text-white hover:bg-ink">Follow on Instagram</a>
          : <p className="mt-6 text-ink/60">Our Instagram link is coming soon.</p>}
      </div>
    </section>
  );
}
