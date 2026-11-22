// Instant feedback inside the admin panel while the next admin page loads.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="max-w-3xl animate-pulse space-y-4 border border-line bg-white p-5 sm:p-6">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-48 bg-chalk" />
      <div className="h-4 w-full bg-chalk" />
      <div className="h-4 w-2/3 bg-chalk" />
      <div className="h-40 w-full bg-chalk" />
    </div>
  );
}
