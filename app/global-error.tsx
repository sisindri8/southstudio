'use client';
// Last resort: only used if the root layout itself crashes. It must render its own <html>/<body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en"><body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '6rem 1rem' }}>
      <h1>We’re having a temporary problem</h1>
      <p>Please try again in a moment.</p>
      <button onClick={reset} style={{ padding: '0.5rem 1rem', border: '2px solid #0B0B0B', background: '#fff', cursor: 'pointer' }}>Try again</button>
    </body></html>
  );
}
