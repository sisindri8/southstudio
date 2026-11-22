# Growing beyond free tiers without a rewrite

| Component | Now (free) | Later | What changes in code |
|---|---|---|---|
| Render | Free | Starter ($7) then Standard | Nothing. Starter removes sleeping. Don't scale to 2+ instances before replacing the in-memory pieces below. |
| Supabase | Free | Pro | Nothing. Gains daily backups, no pausing, more storage/egress. Keep the weekly dumps anyway. |
| Cloudflare | Free | Pro only if you need more rate-limit rules / Super Bot Fight Mode | Dashboard only. |
| Cache (affiliate links) | `lib/linkstore.ts` in-memory | Redis (e.g. Upstash free tier first) | Replace the `Map` with get/set + TTL; keep `resolveLink()` signature. Needed once you run >1 instance (otherwise each has its own cache; the 5-min TTL bounds staleness). |
| Rate limiting | `lib/ratelimit.ts` in-memory | Redis/Upstash (`INCR` + `EXPIRE`) | Reimplement `rateLimit()` (make it async); 7 call sites. Middleware needs an Edge-compatible client (HTTP Redis). |
| Click analytics | `lib/clicks.ts` micro-batch queue | Durable queue (BullMQ + Redis, or a Postgres insert via a worker) | `createClickQueue(sink)` already takes an injectable sink; replace the `clickQueue()` wiring only. Gives retry across restarts: the guarantee the in-memory version cannot give. |
| Images | Sharp at upload, Supabase Storage | Supabase image transformations (Pro) or Cloudflare Images | Only `lib/img.ts` URL building and `OptImage` change. Stored files are immutable and addressable by size. |
| Search | Trigram `ILIKE` | PostgreSQL full-text or an external engine | Isolated in `loadHome()`; the indexes in 0007 stay useful. |
| Monitoring | UptimeRobot + logs | Sentry, Render alerts, log drain | Structured JSON logs are already drain-ready. |

## Upgrade triggers (use your own numbers)
- Render: memory > 400 MB regularly, p95 page time visibly poor, or you want no cold starts.
- Supabase: DB > 400 MB, egress > 4 GB/month, or you need guaranteed backups / no pausing.
- Click accuracy matters for decisions: move to the durable queue.
- A second Render instance: first move links cache + rate limits to Redis.
