# Monitoring on free tiers

## Health endpoints
| URL | Does | Use for |
|---|---|---|
| `/api/health` | `{"ok":true}`, **no database call** (unchanged in meaning) | Render's `healthCheckPath` |
| `/api/health/db` | one tiny read-only query; returns 503 if the database is unreachable; also reports click-queue counters `{pending, lost, dropped}`; rate-limited 30/min/IP | UptimeRobot, and as Supabase keep-alive |

## UptimeRobot (free)
1. Add monitor > HTTP(s) > URL `https://<service>.onrender.com/api/health/db` (the **onrender.com** address avoids Cloudflare Bot Fight Mode), interval 5 min (the free minimum at time of writing).
2. Keyword monitor: alert if the response does **not** contain `"ok":true`.
3. Add a second plain monitor on your public home page to detect Cloudflare/DNS problems.
4. Alerts by email. Do not alert on a single failure (set "alert after 2 failures"): Render's cold start takes ~30-60 s.
5. Watch `clicks.lost` and `clicks.dropped` in the JSON: any non-zero value means clicks went uncounted (Supabase was unreachable for a long time). Revenue was not affected.

## Logs (works today, no extra dependency)
Every important event is one JSON line in Render > Logs. Search for these:

| Event | Meaning | Action |
|---|---|---|
| `db.error` | A Supabase call failed (`where` tells which) | Check Supabase status/paused project |
| `go.url_rejected` | A stored affiliate URL was refused (unapproved host) | Fix the link or add the domain to `AFFILIATE_EXTRA_HOSTS` |
| `go.served_stale` | DB was down; an older URL was served so the sale was not lost | Check Supabase |
| `clicks.flush_failed` / `clicks.lost` / `clicks.dropped` | Analytics writes failing / events lost / buffer overflow | Check Supabase; numbers are in `/api/health/db` |
| `saved.auth_unavailable`, `saved.read_failed` | Saved-items backend problem | Check Supabase |
| `image.process_failed` | An uploaded image could not be processed (original untouched) | Try another file |

Logs never contain cookies, tokens, keys, request bodies or e-mail addresses (redacted in `lib/log.ts`; covered by a unit test).
Render Free keeps only a short log history: use Render's log stream or check regularly.

## Sentry (optional, NOT installed)
`@sentry/nextjs` adds build time, memory and a dependency, so it was not added. When you want it:
1. Create a free Sentry project (Next.js). 2. `npx @sentry/wizard@latest -i nextjs` (it edits `next.config.mjs` and adds config files). 3. Set `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` in Render. 4. Keep `tracesSampleRate` low (0.05) and **disable session replay** to protect free quotas and memory. 5. Re-run `npm run build` and watch Render memory afterwards. Use `beforeSend` to drop request cookies and bodies.

## Dashboards to check weekly
- **Render > Metrics:** memory should stay well under 512 MB (this build measured ~165-215 MB RSS locally under test traffic); CPU spikes during admin image uploads are expected.
- **Supabase > Reports / Usage:** database size (500 MB), storage (1 GB), egress (5 GB + 5 GB cached), and project paused/active state.
- **Cloudflare > Analytics:** cache hit ratio for static assets, blocked requests.

## When to upgrade (rules of thumb, see `UPGRADE_PATH.md`)
Render memory > 400 MB regularly, or visible slowness from 0.1 CPU; Supabase database > 400 MB or egress > 4 GB; any week with `clicks.lost` > 0 that matters to you.
