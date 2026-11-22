# Testing report

Three labels are used throughout. **EXECUTED** = I ran it and saw the result. **NOT EXECUTED** = I could not, and why. **CODE REVIEW** = reasoned from the source only.

## Environment (important for interpreting results)
- No access to your Supabase, Render, Cloudflare, Google OAuth, UptimeRobot or Sentry. Instead:
  - a **mock Supabase** (`scripts/mock-supabase.mjs`: PostgREST filters/embeds/ordering/count, Auth `/user`, Storage upload/list/download, failure + latency injection, request counters, and the `admin_profiles` RLS rule);
  - a throwaway **PostgreSQL 16** with minimal Supabase stubs for all SQL work.
- No web browser (cannot download one here). Client-side JavaScript behaviour is therefore **CODE REVIEW + HTML inspection**.
- Google Fonts are unreachable from the sandbox, so test builds used Next's internal mocked-font hook (`NEXT_FONT_GOOGLE_MOCKED_RESPONSES`, outside the project). Render builds download the real fonts.
- The sandbox CPU is much faster than Render Free (0.1 CPU) and the mock answers instantly (plus injected latency). **Latency numbers are before/after comparisons on identical conditions, not predictions of your production speed.**

## Automated checks (EXECUTED, on a clean `npm ci`)
| Check | Result |
|---|---|
| `npm ci` from lockfile | OK |
| `npm run typecheck` (tsc, strict) | pass |
| `npm run build` (Next 14.2.35 production build) | pass |
| `npm test` (16 unit tests, `tsx --test`) | **16 / 16 pass** |
| `bash scripts/smoke.sh` against built app + mock (black-box) | **53 / 53 pass**, run twice from a clean slate |
| `npm run lint` | **not available**: the project has no ESLint config/script (unchanged) |

Unit tests cover: image pipeline (3 WebP sizes, alpha kept, no upscaling, EXIF rotate + strip, rejection of SVG/GIF/text/empty/truncated/oversize, 30000x1000 pixel bomb rejected in <2 s), URL helpers + legacy fallback, affiliate URL policy (javascript:, data:, userinfo tricks, `amazon.in.evil.com`, IPs, localhost, tracking params), rate limiter (window, isolation, memory cap), client-IP trust, link cache (coalescing, TTL, negative cache, stale-on-error, invalidation, blocked host), click queue (non-blocking, batching, retry, loss accounting, overflow, **and a regression for a bug the load test exposed**), param parsing/SEO rules, log redaction.

## Requirement-by-requirement (your section 14 list)
| # | Area | Status | How |
|---|---|---|---|
| 1 | Homepage | EXECUTED | smoke + k6; 24 cards render |
| 2 | Product details | EXECUTED | 200 / real 404 / draft 404; srcset/eager/lazy attributes inspected |
| 3 | Category pages | EXECUTED | `/?cat=`, page 2, indexability |
| 4 | Search | EXECUTED (app) + EXECUTED (SQL on real Postgres) | min length, malformed params, rate limit 429 |
| 5 | Pagination | EXECUTED | page 2, `page=99999` (empty, no crash). Stable ordering is **CODE REVIEW** |
| 6 | Filtering | EXECUTED | sort/deals/retailer; indexes proven by `EXPLAIN ANALYZE` |
| 7 | Affiliate redirects | EXECUTED | 302, tag preserved, no-store, host/uuid/draft guards, cached speed, stale-on-error, 503 on cold outage |
| 8 | Click tracking | EXECUTED | async, bots excluded, batched; 31/31 stored in load test; shutdown loss window measured |
| 9 | Authentication | EXECUTED (mock) / NOT EXECUTED (real Google OAuth) | session cookie paths, admin gate, shopper blocked; **RLS proven on real Postgres** |
| 10 | Saved items | EXECUTED (API) / CODE REVIEW (browser) | signed-out = 0 DB/auth calls; valid / expired / auth-down |
| 11 | Admin dashboard | PARTIAL | gate, product page, save action executed. Full admin UI not exercised in a browser |
| 12 | Image uploads | EXECUTED | real server action: 3.5 MB JPEG + transparent PNG -> 6 files; disguised SVG rejected, nothing written |
| 13 | Image optimisation | EXECUTED | 3,501,256 B -> sm 7,770 / md 55,910 / lg 225,396 B; Cache-Control `max-age=31536000` |
| 14 | API error handling | EXECUTED | 503 / 429 / 413 paths |
| 15 | Database failure handling | EXECUTED | product 500 (uncached, instant recovery), `/go` stale + 503, sitemap, saved 503, health split |
| 16 | Rate limiting | EXECUTED | search 29 OK then 429; auth 20/min; other IP unaffected; 413 cap; admin exempt from public cap |

### Before/after on the original code (EXECUTED, same mock)
| Scenario | Original | Now |
|---|---|---|
| Missing product HTTP status | 200 (soft-404) | **404** |
| Existing product during DB outage | 200 "Page not found" | **500**, not cached, recovers instantly |
| Edit a link in DB, then `/go` 70 s later | still old URL | new URL within TTL (≤5 min); **instant** after an admin save |
| `/go` with 300 ms DB latency | 305 ms | ~3 ms (cached) |
| 200 distinct searches: on-disk cache files | +200 | +0 (search not cached) |
| `?q=a&q=b` | handler error | 200 |
| `/?q=x` canonical / robots | none | `noindex,follow` |

## Database (EXECUTED on real PostgreSQL 16; 50,000 products, 100,000 links, 100,000 clicks, synthetic data)
Migrations 0001-0006 applied cleanly; 0007 applied twice (idempotent). `EXPLAIN ANALYZE`, best of 3:

| Query (as the app issues it) | Before | After |
|---|---|---|
| Search, rare term (3-column ILIKE) | 196.9 ms (seq scan) | **0.14 ms** (bitmap on trigram indexes) |
| Search, common term | 0.44 ms (planner stops early) | 0.33 ms |
| Price low-to-high | 29.1 ms | **0.12 ms** |
| Price high-to-low | 32.6 ms | **0.14 ms** |
| Biggest discount | 0.26 ms | 0.14 ms |
| Category page | 0.17 ms | 0.09 ms |
| Store filter | 5.7 ms | **0.11 ms** |
| Delete 100 links (FK clean-up of clicks) | 589 ms | **43 ms** |
New indexes total about 24 MB at this size. The data is generated, so absolute numbers will differ for yours; the plans (seq scan -> index) are the point.
Also executed on real Postgres: **RLS** (shopper sees 0 admin rows and cannot insert products; admin can; anon sees published products only and no clicks), backup + restore round trip (counts identical).

## Load tests (EXECUTED, k6 v0.55, `loadtest/k6-mix.js`)
Mix: 30% home, 35% product, 10% search, 10% category, 15% `/go` (redirect not followed). 60 ms injected DB latency. Local only; **never run against production**.

| | 10 VUs, 55 s | | 40 VUs, 40 s | |
|---|---|---|---|---|
| | Original | Now | Original | Now |
| Requests/s (iterations) | 4.4 | 4.2 | 15.9 | 15.8 |
| Error rate (real errors) | 0 % | 0 % | 0 % | 0 %* |
| Page p95 | 82 ms | 73 ms | 83 ms | 85 ms |
| **`/go` median / p95** | 69 / 132 ms | **3 / 69 ms** | 70 / 132 ms | **2.6 / 58 ms** |
| DB requests during run | 66 (27 click inserts) | 72 (11 batched) | 129 (92 inserts) | 102 |
| Peak process memory (RSS) | 167 MB | 173 MB | 205 MB | 215 MB |
| Avg CPU of one core | 12 % | 14 % | 29 % | 30 % |
\* 25 responses were HTTP 429 from my own search limiter (single test IP); the k6 script now treats 429 as expected.
Reading: pages are unchanged (they were already cached); `/go` is much faster and stops writing synchronously; memory is similar. Search issues more DB calls than before because search is deliberately no longer cached (disk-growth fix); it is rate-limited. **Not measured:** real Supabase latency, Render Free CPU limits, Cloudflare effects, image-bandwidth savings in real browsers.

### A real bug found by the load test
First run: 40 `/go` requests but only 11 clicks stored, `pending: 29`. Root cause: in `flush()`, calling it with an empty buffer marked the queue "flushing" forever, so later flushes were no-ops. Fixed, regression test added, re-run: **31 requests -> 31 stored, pending 0, lost 0**. Unit tests alone had not caught it.

### Click loss on shutdown (EXECUTED)
| Kill signal | Killed right after click | Killed 0.6 s after |
|---|---|---|
| SIGTERM | 5 of 5 **lost** | 5 of 5 stored |
| SIGKILL | 5 of 5 **lost** | 5 of 5 stored |
The flush window is ~250 ms. Next exits on SIGTERM without waiting for our write, so analytics must be treated as best effort (see `LIMITATIONS.md`).

## NOT EXECUTED
- Anything against real Supabase/Render/Cloudflare (including real Google sign-in, Turnstile, AdSense, Cloudflare cache headers `cf-cache-status`).
- Browser-level behaviour: heart buttons, `onError` image fallback, which srcset candidate a real browser picks, error-boundary rendering, LCP/CLS numbers (Lighthouse).
- Memory/CPU on Render Free's 0.1 CPU (admin uploads will be several times slower than the ~1.8 s measured here).
- Restoring a backup into a fresh *Supabase* project; GitHub Actions backup example; Sentry.
- Load beyond 40 virtual users; long soak test.
- Real image **bandwidth** savings: computed from file sizes (e.g. 3.5 MB -> 8-225 KB per view depending on size) rather than measured in browsers.

## Reproduce
```bash
npm ci && npm run typecheck && npm test
node scripts/mock-supabase.mjs &                       # fixtures + failure injection on :54321
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SITE_URL=http://localhost:3000
npm run build && (npm start -- -p 3000 &)
rm -rf .next/cache/fetch-cache   # before each smoke run: a warm data cache can legitimately mask an outage
BASE=http://127.0.0.1:3000 bash scripts/smoke.sh
k6 run -e BASE=http://127.0.0.1:3000 -e VUS=10 -e LINKS=00000000-0000-4000-8000-000500000001 loadtest/k6-mix.js
```
