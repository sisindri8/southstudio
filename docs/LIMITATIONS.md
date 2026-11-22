# Known limitations (read before launch)

**Analytics and revenue**
- Click analytics are **best effort, not guaranteed**. Clicks sit in memory for ~250 ms before being written in batches. Measured: killing the process (SIGTERM or SIGKILL) <0.25 s after a click loses it; ≥0.6 s later it is safe. Next exits on SIGTERM without waiting for our write, so the shutdown hook rarely helps. Clicks can also be lost if Supabase stays unreachable for ~5 retry cycles or the 2,000-event buffer overflows (both counted: `/api/health/db`, logs `clicks.lost`/`clicks.dropped`). **Redirects and affiliate revenue are never affected.** Admin analytics may slightly under-count.
- Bots, HEAD requests and clicks beyond 120/min from one IP are deliberately not counted.
- Saving a product re-creates its affiliate links with new IDs (pre-existing): old `/go/<id>` URLs 404 afterwards and past clicks lose their link reference. Proposed fix needs approval (see AUDIT.md).
- Links to merchants outside the approved list return 404 until added to `AFFILIATE_EXTRA_HOSTS`.

**Free-tier behaviour**
- Render Free sleeps after ~15 idle minutes: the first visitor waits ~30-60 s. Caches (links, rate-limit counters, click buffer) are lost at each sleep. Supabase Free pauses after a week without activity (the `/api/health/db` ping prevents this) and has no downloadable backups.
- 0.1 CPU: admin image uploads take seconds per image (~1.8 s for a 3.5 MB photo + one PNG on a fast sandbox CPU; expect several times longer on Render Free). Upload fewer images per save if a request times out.
- Supabase image bandwidth (5 GB + 5 GB cached) is outside Cloudflare. Optimisation reduces it ~15-400x per image view, but it is still the first quota to watch.

**Behaviour changes you may notice**
- Search needs 2+ characters (1-character searches are ignored with a hint). Search results are not cached (each search queries the database; limited to 30/min/IP).
- During a Supabase outage product pages return HTTP **500** with the in-site error screen (Next cannot emit 503 from a page). Nothing is cached, recovery is immediate. The home page, which keeps its loading skeleton, returns 200 with the error screen during an outage.
- Category pages are indexable but cannot carry their own canonical tag (Next drops the query string for `/`-path canonicals); duplicates (search/sort/filter) are `noindex,follow` and blocked in robots.txt.
- OG images are now WebP. Facebook and X handle WebP; I did not verify LinkedIn/WhatsApp previews, check with their debuggers.
- Supabase serves the images with `Cache-Control: max-age=31536000` (storage-js cannot add `immutable`).

**Not done / not verified**
- Not run against your real Supabase, Render, Cloudflare, UptimeRobot, Sentry, Google OAuth or Turnstile (no access). All tests used a mock Supabase and a throwaway PostgreSQL.
- No browser was available: client-side behaviour (hearts, image fallback, error screen rendering, srcset selection) is verified by HTML inspection and code review only.
- Sandbox CPU is far faster than Render Free's 0.1 CPU: latency numbers are **relative comparisons**, not predictions.
- Next 14 -> 15/16 upgrade, Sentry, CSP: not done (see SECURITY.md).
