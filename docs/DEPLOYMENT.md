# Deployment (Render Free + Supabase Free), ₹0/month

Platform facts below were checked against the vendors' documentation in Nov 2026. Free tiers change: re-check before relying on a number.

| Service | Free-tier facts that matter to you |
|---|---|
| Render Free web service | 512 MB RAM, 0.1 CPU, **sleeps after ~15 min without traffic** (first visit after that waits ~30-60 s to wake), 750 instance-hours/month (enough for one always-on service), ephemeral disk (wiped on every restart/deploy). |
| Supabase Free | 500 MB database, 1 GB file storage, 5 GB egress + 5 GB cached egress, **project pauses after 1 week with no activity**, **no automatic backups you can download**. |
| Cloudflare Free | CDN, DNS, SSL, Bot Fight Mode, a very small number of rate-limit rules. |

## 0. Before the first deploy

1. **Check your existing affiliate link domains** (the new redirect guard only allows approved merchants). Run in the Supabase SQL editor:
   ```sql
   select split_part(split_part(affiliate_url,'/',3),':',1) as host, count(*)
   from product_affiliate_links group by 1 order by 2 desc;
   ```
   Any host that is **not** in the built-in list (`lib/affiliate.ts`: Amazon, Flipkart, Myntra, Ajio, Meesho, Nykaa, Decathlon, Snapdeal, Tata CLiQ, Croma, Nike, Adidas, Puma, EarnKaro, Cuelinks, ...) must be added to `AFFILIATE_EXTRA_HOSTS`, otherwise those links return 404 (and are logged as `go.url_rejected`). Generic shorteners (bit.ly etc.) are deliberately **not** approved because they can point anywhere; add them yourself only if you accept that.
2. Run **`supabase/migrations/0007_search_and_listing_indexes.sql`** in the SQL editor. It is additive and idempotent (safe to re-run). It does not change data.

## 1. Render

1. Push the project to GitHub; in Render: New > Blueprint (uses `render.yaml`) or New > Web Service.
2. Set environment variables (see `.env.example`). `NEXT_PUBLIC_*` are baked in at **build** time: set them before the first build, and **redeploy** after changing them.
3. Node: `NODE_VERSION=20` (Sharp requires >= 20.9; `20` gives the latest 20.x).
4. Health check path stays `/api/health` (no database call, so a Supabase hiccup never makes Render restart the service).
5. After deploy, open `https://<your-service>.onrender.com/api/health` -> `{"ok":true}` and `/api/health/db` -> `{"ok":true,"db":true,...}`.

## 2. Keep the free stack awake (optional but recommended)

- Render sleeps after 15 idle minutes and Supabase pauses after a week of inactivity. A visitor arriving after either waits (Render) or sees errors (Supabase paused).
- Point UptimeRobot (free) at **`https://<your-service>.onrender.com/api/health/db`** every 5 minutes (see `MONITORING.md`). It keeps Render awake and counts as database activity. Check Render's current free-tier terms about automated pings; if you later move to a paid Render plan the Render part becomes unnecessary, but keep the pings against Supabase Free.
- A paused Supabase project can be resumed in its dashboard; data is kept.

## 3. Optimise existing product images (optional, recommended)

New uploads are optimised automatically. Existing products still point at their original (possibly 5 MB) files. From your computer:
```bash
npm ci
set -a; . ./.env.local; set +a          # your Supabase URL + service key
npm run backfill:images                  # DRY RUN: shows what would happen, changes nothing
npm run backfill:images -- --limit 5 --apply   # try 5 first
npm run backfill:images -- --apply
```
Originals are never deleted; `backfill-report.json` lists old->new URLs for rollback. Logo/banner images stored in site settings are not covered: re-upload them once in admin > Settings.

## 4. Rolling back

- Code: redeploy the previous commit in Render.
- Migration 0007: indexes only; `drop index if exists <name>;` reverts any of them. Nothing else depends on them.
- Images: old originals remain in Storage; restoring a row's old URL (from `backfill-report.json`) reverts it.

## 5. After each deploy, spot-check (2 minutes)

`/`, one product page, `/?q=<something>`, click **Buy** on a product (should 302 to the merchant with your tag), `/admin` login, and upload one product image.
