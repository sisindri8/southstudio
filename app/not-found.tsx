import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-6xl font-extrabold">404</p>
      <h1 className="mt-4 font-display text-2xl font-extrabold uppercase">Page not found</h1>
      <p className="mt-3 text-ink/70">The page may have moved, or the product is no longer listed.</p>
      <Link href="/" className="btn mt-6">Back to the shop</Link>
    </section>
  );
}
