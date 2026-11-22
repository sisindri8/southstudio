# Architecture audit, problems found, and what changed

Everything below was measured by running the project (original and modified) against a local mock of Supabase and, for SQL, a real
PostgreSQL 16. Items marked **[code review]** were found by reading code but not reproduced.

## 1. What the project actually is (differs from the brief in places)

| Area | Reality |
|---|---|
| Framework | Next.js 14.2 App Router, TypeScript, Tailwind. Single Node server (`next start`). |
| Data | Supabase via `@supabase/supabase-js` / `@supabase/ssr`. Public pages use the anon key (RLS-protected); admin uses the service-role key, server-side only. |
| Auth | Supabase Auth (Google OAuth) for shoppers and admins. `/admin/*` is gated in `middleware.ts`, and **every** admin action/route re-checks `requireAdmin()` (all 9 verified). |
| Images | Admin uploads go to Supabase Storage **as the original file**. No Sharp existed. Rendered with plain `<img>`. The "sticker maker" in admin produces **transparent PNGs** (so the pipeline must keep alpha). |
| Affiliate flow | `/go/<linkId>` looked up the link then **awaited** a click insert, then 302. |
| Search | Home page `/?q=&cat=&sort=&deals=&retailer=&page=`. There is **no** `/api/search`; categories are `/?cat=slug`, not separate routes. |
| Saved items | `GET /api/saved` called by every heart button on mount. |
| Pre-existing | `/api/health` (kept unchanged in meaning), `robots.ts`, `sitemap.ts`, JSON-LD on product pages, Turnstile on forms, migrations 0001-0006. |

## 2. Problems found (with evidence)

| # | Problem | Evidence | Severity |
|---|---|---|---|
| 1 | **`/go` served stale/forever-cached affiliate URLs.** Next's fetch data cache had no expiry for the link lookup. Edited URLs, unpublished products and deleted links kept redirecting until a restart. | Changed a link in the DB; 70 s+ later `/go` still sent visitors to the old URL. | **High (revenue)** |
| 2 | `/go` waited for the click-analytics write. | 305 ms with 300 ms DB latency; click-insert on the critical path. | High |
| 3 | **Missing product returned HTTP 200** (soft 404). | `curl -D-` showed `200 OK` with a `noindex` tag and "Page not found" text. Cause: root `loading.tsx` starts streaming before `notFound()` can set a status. | High (SEO) |
| 4 | **DB outage on a product page showed "Page not found"** (HTTP 200) because `load()` ignored the Supabase `error`. | Injected 503 on the database; an existing product rendered not-found. | High |
| 5 | Homepage/sitemap/nav treated DB errors as "no data" (empty sitemap, empty menu, "no products"). | **[code review]** + sitemap was statically prerendered at build time. | Medium |
| 6 | Search results cached on disk per distinct query, never evicted. | 200 distinct `?q=` -> 200 new cache files (~0.9 MB). A bot can grow this without bound. | Medium |
| 7 | `?q=a&q=b` (array param) crashed the page handler. | **[code review]** `.replace()` on an array. | Medium |
| 8 | Original images (up to 5 MB) served as-is; no srcset. | Code. 3.5 MB test JPEG -> now 8 / 56 / 225 KB. | High (bandwidth) |
| 9 | Search `ILIKE '%x%'` cannot use the existing full-text index. | Real Postgres, 50k products: rare term **197 ms** seq scan. | Medium (grows with catalogue) |
| 10 | Price sorts had no index; store filter had no index on `retailer_id`; `affiliate_clicks` foreign keys unindexed (slow deletes as clicks grow). | `EXPLAIN ANALYZE`: 29-33 ms parallel seq scans; link delete 589 ms/100. | Medium |
| 11 | No canonical / noindex on filter, sort, search URLs (duplicate content). | `curl` of `/?sort=...` and `/?q=...`: no robots meta, no canonical. | Medium (SEO) |
| 12 | Saved-items API hit for every signed-out visitor on every page. | **[code review]** (`SaveButton` calls on mount unconditionally). | Low-Med |
| 13 | No rate limiting, no body-size limit on public form posts (server-action limit is a global 35 MB). | Code. | Medium |
| 14 | `/_next/image` optimizer enabled for your Supabase host (CPU / disk-growth abuse target; two matching `npm audit` advisories). | `next.config.mjs` + `npm audit`. | Medium |
| 15 | **Saving a product deletes and re-creates its affiliate links with new IDs.** Old `/go/<id>` URLs then 404; `affiliate_clicks.link_id` of past clicks becomes NULL. Previously masked by problem 1. | Observed in end-to-end admin edit. **Not changed** (needs your approval, see below). | Medium |
| 16 | `npm audit`: Next 14.x advisories fixed only in Next 15/16 (RSC deserialization DoS, rewrites smuggling), plus `postcss`, `zod`, `@supabase/auth-js`. | `npm audit`. **Not changed** (major upgrade, needs approval). | Medium |

## 3. What was changed

| Area | Change | Files |
|---|---|---|
| Images | Sharp pipeline (validate by decoding, 5 MB / 24 MP limits, EXIF strip, WebP at 400/800/1400 px, alpha kept), one-year `Cache-Control`, immutable uuid paths, `srcset`/`sizes`, lazy loading, priority for LCP image, fallback on error, `/_next/image` disabled. No DB change: the stored URL is the `lg.webp`; other sizes are derived by name; old URLs keep working. | `lib/images.ts`, `lib/img.ts`, `app/OptImage.tsx`, cards/product/carousel/layout, `actions.ts`, `next.config.mjs` |
| `/go` | In-memory link cache (5 min, immediate invalidation on admin save, coalesced lookups, 24 h stale-if-error, 30 s negative cache), read-only anon client, no-store, host allow-list + protocol/IP/credential checks, 503 + `Retry-After` on DB failure (never a false 404), non-blocking micro-batched click queue with retry and loss counters, bots/HEAD not counted. | `app/go/[linkId]/route.ts`, `lib/linkstore.ts`, `lib/clicks.ts`, `lib/affiliate.ts` |
| 404 bug | Three distinct outcomes (found / missing / DB error). Real 404 for missing and draft; 500 (uncached) for outages; `loading.tsx` scoped to the browse page via a `(browse)` route group (URLs unchanged). Failed helpers call `noStore()`. | `app/products/[slug]/page.tsx`, `lib/log.ts`, `lib/site.ts`, `app/(browse)/*` |
| Saved items | No request unless a Supabase session cookie exists; one authoritative check on click; 30 s retry back-off; auth-service outage returns 503 (does not log users out). | `app/SaveButton.tsx`, `app/api/saved/route.ts` |
| Database | Migration `0007`: trigram indexes (same matching behaviour), partial sort indexes, retailer + FK indexes. Search input validated (2-80 chars), stable sort tie-breaker, uncached search. | `supabase/migrations/0007_*.sql`, `lib/listing.ts` |
| SEO | `noindex,follow` for search/sort/deals/store/empty/unknown-category views; canonical on home and its duplicates; categories added to sitemap; sitemap now dynamic and fails loudly; robots blocks search/filter patterns; OG/Twitter metadata on products. | `app/(browse)/page.tsx`, `sitemap.ts`, `robots.ts` |
| Protection | Per-IP limits: search 30/min, auth callbacks 20/min, public server actions 60/min, contact 5/h, subscribe 10/h, export 10/10 min; public POST body cap 64 KB; `Cache-Control: private, no-store` on private areas. | `middleware.ts`, `lib/ratelimit.ts`, `next.config.mjs` |
| Graceful degradation | In-layout friendly error page + `global-error`; optional homepage rows may fail without failing the page; image placeholder; hearts never block browsing. | `app/error.tsx`, `app/global-error.tsx` |
| Ops | `/api/health` unchanged; new `/api/health/db`; structured redacted logging; backup + backfill scripts; docs. | see `docs/` |

## 4. Needs your decision (not done, by design)

1. **Stable affiliate link IDs** (problem 15): make "save product" update links in place instead of delete/re-create. Small code change, no schema change; changes admin save behaviour.
2. **Next.js upgrade to 15/16** (problem 16): major version; needs a regression pass.
3. **Real category URLs** (`/category/<slug>`): Next's metadata API drops the query string from a canonical whose path is `/`, so `/?cat=x` cannot carry its own canonical. Today category pages are indexable with no canonical tag (Google self-canonicalises). Dedicated routes would allow exact canonicals but change URLs (needs redirects).
