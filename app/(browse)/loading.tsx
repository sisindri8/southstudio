// The skeleton is scoped to the browse page via the (browse) route group: pages wrapped by a loading.tsx start streaming
// immediately and can no longer return a real 404/5xx status, so product pages must NOT sit under it.
// Shown the instant a link is clicked, while the next page is prepared on the server.
// Without this file the old page just sits there until the new one is ready, which feels like the click did nothing.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-6xl animate-pulse px-4 py-10">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 bg-chalk" />
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="border-2 border-line">
            <div className="aspect-square bg-chalk" />
            <div className="space-y-2 p-3"><div className="h-3 w-1/3 bg-chalk" /><div className="h-4 w-4/5 bg-chalk" /><div className="h-5 w-1/2 bg-chalk" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
