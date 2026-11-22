// Click analytics WITHOUT making the visitor wait.
//
// recordClick() only pushes onto an in-memory array (microseconds) and returns. A timer writes the buffer to Supabase in
// micro-batches of up to 100 rows (first write ~250 ms after a click; clicks that arrive during a write ride the next batch). Failed batches are retried with back-off.
//
// RELIABILITY - READ THIS: this is "best effort", NOT guaranteed delivery. Clicks can be lost when:
//   * the process dies before the buffer is written (deploy, crash, OOM, Render Free spin-down, SIGKILL). The buffer is written
//     ~250 ms after a click, so the exposure window is a fraction of a second. MEASURED: Next exits on SIGTERM without waiting for
//     our async write, so the SIGTERM/beforeExit hook below is a bonus that usually cannot finish; do not rely on it;
//   * Supabase stays unreachable longer than the retry window (5 attempts), or the buffer overflows (2000 events).
// Losses are counted and logged ("clicks.lost"/"clicks.dropped"). Redirects and affiliate revenue are never affected by
// analytics. For guaranteed counting later, swap the sink for a durable queue (see docs/UPGRADE_PATH.md).
import { log } from './log';

export type Click = { link_id: string; product_id: string; retailer_id: string; referrer: string | null };
export type Sink = (rows: Click[]) => Promise<void>; // must throw on failure
type Item = { c: Click; tries: number };
export type ClickStats = { queued: number; sent: number; dropped: number; lost: number; failedBatches: number };

export function createClickQueue(sink: Sink, o: { max?: number; batch?: number; intervalMs?: number; maxTries?: number; timeoutMs?: number } = {}) {
  const MAX = o.max ?? 2000, BATCH = o.batch ?? 100, EVERY = o.intervalMs ?? 250, TRIES = o.maxTries ?? 5, TIMEOUT = o.timeoutMs ?? 8000;
  let buf: Item[] = [], timer: ReturnType<typeof setTimeout> | null = null, flushing: Promise<void> | null = null, backoff = 0;
  const s: ClickStats = { queued: 0, sent: 0, dropped: 0, lost: 0, failedBatches: 0 };
  const schedule = (ms: number) => { if (!timer) { timer = setTimeout(() => { timer = null; void flush(); }, ms); (timer as any).unref?.(); } };

  function record(c: Click) {
    if (buf.length >= MAX) { s.dropped++; if (s.dropped === 1 || s.dropped % 100 === 0) log.error('clicks.dropped', { dropped: s.dropped }); return; }
    buf.push({ c, tries: 0 }); s.queued++;
    if (buf.length >= BATCH) void flush(); else schedule(backoff || EVERY);
  }

  async function drain(): Promise<void> {
    while (buf.length) {
      const take = buf.splice(0, BATCH);
      try {
        await Promise.race([sink(take.map((t) => t.c)), new Promise<never>((_, rej) => { const t = setTimeout(() => rej(new Error('sink timeout')), TIMEOUT); (t as any).unref?.(); })]);
        s.sent += take.length; backoff = 0;
      } catch (e) {
        s.failedBatches++;
        const keep = take.filter((t) => ++t.tries < TRIES);
        const lost = take.length - keep.length;
        if (lost) { s.lost += lost; log.error('clicks.lost', { lost, totalLost: s.lost, message: (e as Error)?.message }); }
        buf = keep.concat(buf).slice(0, MAX);
        backoff = Math.min(60_000, (backoff || 2000) * 2);
        log.warn('clicks.flush_failed', { retryInMs: backoff, queued: buf.length, message: (e as Error)?.message });
        schedule(backoff);
        return; // wait for the back-off before trying again
      }
    }
  }

  function flush(): Promise<void> {
    if (flushing) return flushing;
    // .finally() runs in a LATER microtask than this assignment. (Clearing the flag inside drain() itself would, for an
    // empty buffer, run before the assignment and leave "flushing" stuck forever, which silently stopped all flushing.)
    const p: Promise<void> = drain().finally(() => { if (flushing === p) flushing = null; });
    flushing = p;
    return p;
  }

  return { record, flush, stats: (): ClickStats & { pending: number } => ({ ...s, pending: buf.length }) };
}

// ---- the real queue, writing to Supabase with the service-role client (server only) ----
const g = globalThis as unknown as { __clickQueue?: ReturnType<typeof createClickQueue>; __clickSignals?: boolean };
export function clickQueue() {
  if (!g.__clickQueue) {
    g.__clickQueue = createClickQueue(async (rows) => {
      const { admin } = await import('./supabase');
      const { error } = await admin().from('affiliate_clicks').insert(rows);
      if (error) throw new Error(error.message);
    });
    if (!g.__clickSignals) {
      g.__clickSignals = true;
      const q = g.__clickQueue;
      const drain = () => { void q.flush(); };
      process.once('SIGTERM', drain); process.once('SIGINT', drain); process.once('beforeExit', drain);
    }
  }
  return g.__clickQueue;
}
