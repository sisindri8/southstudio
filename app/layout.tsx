import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Unbounded, Inter, Bebas_Neue } from 'next/font/google';
import { getSite, getNav } from '@/lib/site';
import SocialIcons from './SocialIcons';
import Nav from './Nav';
import Subscribe from './Subscribe';
import AdsLoader from './AdsLoader';
import Chrome from './Chrome';
import OptImage from './OptImage';

const display = Unbounded({ subsets: ['latin'], weight: ['500', '800'], variable: '--f-display' });
const cond = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--f-cond' });
const body = Inter({ subsets: ['latin'], variable: '--f-body' });

// Public pages refresh at least every 60 s (and instantly after an admin save).
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: { default: 'Studio South: shop the best deals', template: '%s | Studio South' },
    description: 'Discover fashion, apparel, electronics, home, beauty and sports products, with links to the retailers that sell them.',
    // Rendered by Next inside <head>. Never write <head> by hand here: an empty-string child (ads.client === '') breaks hydration.
    ...(site.ads.client ? { other: { 'google-adsense-account': site.ads.client } } : {}),
  };
}

export default async function Root({ children }: { children: React.ReactNode }) {
  const [site, nav] = await Promise.all([getSite(), getNav()]);
  const header = (
      <header className="border-b border-line">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 pt-5">
          <form action="/" role="search" className="max-w-[220px]">
            <input name="q" placeholder="Search" aria-label="Search products" className="w-full border-b border-ink bg-transparent py-1 text-sm outline-none" />
          </form>
          <Link href="/" aria-label="Studio South home" className="justify-self-center font-display text-xl font-extrabold uppercase tracking-[0.2em] sm:text-2xl">
            {site.logo ? <OptImage src={site.logo} alt="Studio South" sizes="200px" priority className="h-10 w-auto sm:h-12" fallback="Studio South" /> : 'Studio South'}
          </Link>
          <Link href="/account" className="justify-self-end text-sm">Account</Link>
        </div>
        <Nav nav={nav} />
      </header>
  );
  const footer = (
    <>
      {!!(site.socials.instagram || site.instagram.image || site.instagram.logo || site.instagram.title || site.instagram.text) && (
        <section className="bg-ink px-4 py-16 text-white">
          <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-2">
            {!!site.instagram.image && <OptImage src={site.instagram.image} alt="Studio South on Instagram" sizes="(min-width: 768px) 480px, 90vw" className="mx-auto max-h-72 w-auto border-2 border-white object-cover" />}
            <div className={site.instagram.image ? 'text-center md:text-left' : 'text-center md:col-span-2'}>
              {site.instagram.logo
                ? <><h2 className="sr-only">{site.instagram.title || 'Follow us on Instagram'}</h2><OptImage src={site.instagram.logo} alt="Partner logos" sizes="(min-width: 768px) 576px, 90vw" className="mx-auto h-auto w-full max-w-xl md:mx-0" /></>
                : <p className="font-display text-2xl font-extrabold uppercase sm:text-3xl">{site.instagram.title || 'Follow us on Instagram'}</p>}
              {!!(site.instagram.text || site.instagram.logo) && <p className={site.instagram.logo ? 'mx-auto mt-5 max-w-xl text-xl font-semibold text-white sm:text-2xl md:mx-0' : 'mt-2 max-w-xl text-white/70'}>{site.instagram.text || 'Discover new finds, curated by hand.'}</p>}
              <Link href="/instagram" className="mt-5 inline-block bg-flare px-6 py-3 text-sm font-bold uppercase tracking-wider">See our Instagram</Link>
            </div>
          </div>
        </section>
      )}
      <section className="bg-lime px-4 py-16 text-center">
        <p className="font-display text-2xl font-extrabold sm:text-4xl">{site.cta.text}</p>
        {!!site.cta.button && <a href={site.cta.link || '/'} className="mt-4 inline-block border-b-2 border-ink text-sm font-semibold">{site.cta.button}</a>}
      </section>
      <footer className="bg-white px-4 pb-8 pt-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <p className="font-display text-5xl font-extrabold uppercase leading-[1.1] text-ink lg:text-6xl xl:text-7xl">Studio<br />South</p>
              <p className="mt-4 max-w-sm text-sm text-ink/70">Product discovery for fashion, apparel, electronics, home, beauty and sports.</p>
              <div className="mt-5"><SocialIcons socials={site.socials} /></div>
              <Subscribe />
            </div>
            <nav aria-labelledby="f-links">
              <h2 id="f-links" className="text-xs font-bold uppercase tracking-widest">Explore</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li><Link href="/about" className="hover:text-flare hover:underline">About us</Link></li>
                <li><Link href="/contact" className="hover:text-flare hover:underline">Contact</Link></li>
                <li><Link href="/editorial-guidelines" className="hover:text-flare hover:underline">Editorial guidelines</Link></li>
              </ul>
            </nav>
            <nav aria-labelledby="f-legal">
              <h2 id="f-legal" className="text-xs font-bold uppercase tracking-widest">Legal</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li><Link href="/privacy-policy" className="hover:text-flare hover:underline">Privacy policy</Link></li>
                <li><Link href="/terms-of-use" className="hover:text-flare hover:underline">Terms of use</Link></li>
                <li><Link href="/cookie-policy" className="hover:text-flare hover:underline">Cookie policy</Link></li>
                <li><Link href="/disclaimer" className="hover:text-flare hover:underline">Disclaimer</Link></li>
              </ul>
            </nav>
          </div>
          <section aria-labelledby="f-disc" className="mt-12 gap-8 border border-ink/20 bg-white p-5 sm:p-6 md:grid md:grid-cols-[1fr_3fr]">
            <h2 id="f-disc" className="text-xs font-bold uppercase tracking-widest">Affiliate disclosure</h2>
            <div className="mt-3 md:mt-0">
              <p className="text-sm leading-relaxed text-ink/70">{site.disclosure}</p>
              <Link href="/affiliate-disclosure" className="mt-3 inline-block text-sm font-semibold underline">Read the full disclosure</Link>
            </div>
          </section>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-ink/20 pt-5 text-xs text-ink/70">
            <p>© {new Date().getFullYear()} Studio South. All rights reserved.</p>
            <p>We do not sell or ship products.</p>
          </div>
        </div>
      </footer>
    </>
  );
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${cond.variable}`}>
        {site.ads.enabled && site.ads.client ? <AdsLoader client={site.ads.client} /> : null}
        <Chrome header={header} footer={footer}>{children}</Chrome>
      </body>
    </html>
  );
}
