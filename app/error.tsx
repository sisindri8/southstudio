'use client';
import Link from 'next/link';

// Shown inside the normal header/footer when a page cannot load its data (for example Supabase is down or paused).
// It is never cached and never claims the product or page does not exist.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-extrabold uppercase">We’re having a temporary problem</h1>
      <p className="mt-3 text-ink/70">The page could not be loaded right now. This is usually brief. Please try again in a moment.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="btn">Try again</button>
        <Link href="/" className="btn">Home</Link>
      </div>
    </section>
  );
}
