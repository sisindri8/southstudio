import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PAGES, getPage } from '@/lib/pages';

export function generateStaticParams() { return Object.keys(PAGES).map((slug) => ({ slug })); }
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const pg = getPage(params.slug);
  return pg ? { title: pg.title, description: pg.intro } : {};
}
export default function InfoPage({ params }: { params: { slug: string } }) {
  const pg = getPage(params.slug);
  if (!pg) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold uppercase sm:text-4xl">{pg.title}</h1>
      {pg.intro && <p className="mt-3 text-lg text-ink/70">{pg.intro}</p>}
      {pg.sections.map((s) => (
        <section key={s.h} className="mt-8">
          <h2 className="text-xl font-bold">{s.h}</h2>
          {s.p.map((t, i) => <p key={i} className="mt-2 leading-relaxed text-ink/80">{t}</p>)}
        </section>
      ))}
    </article>
  );
}
