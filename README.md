# Studio South

Next.js 14 + Supabase affiliate storefront, deployed on Render.

## Setup
1. Create a Supabase project. In the SQL editor run, **in order**:
   `supabase/migrations/0001_init.sql`, `0002_categories.sql`, `0003_hardening.sql`, `0004_features.sql`, `0005_subscribers.sql`, `0006_saved_items.sql`
   (0001 also creates the public `product-images` bucket).
2. Create an admin: Auth > Users > add user (or sign in once with Google), then run
   `insert into admin_profiles (user_id) select id from auth.users where email = 'you@gmail.com';`
3. `cp .env.example .env.local`, fill values, `npm install && npm run dev`.
4. Render: connect the repo (it reads `render.yaml`). Set all secret env vars **before the first deploy**
   (`NEXT_PUBLIC_*` values are inlined at build time). `NEXT_PUBLIC_SITE_URL` must be your real https URL, not localhost.
   Health check: `/api/health`. Commit `package-lock.json` (the build uses `npm ci`).
5. Open `/admin/setup` after deploying: it checks keys, migrations, storage and the site URL.

## Sign-in (Google only)
Enable Google in Supabase (Authentication > Providers) and turn Email off. Add BOTH redirect URLs under
Authentication > URL Configuration: `<site>/auth/callback` and `<site>/auth/admin/callback`.
Customers: `/login`. Admins: `/admin/login` (must exist in `admin_profiles`).

## Notes
- Affiliate links go through `/go/<linkId>`, which records the click (bots are ignored) then redirects.
- Contact messages are read in `/admin/messages`; click reports are in `/admin/analytics`.
- `/admin/links` checks affiliate URLs (40 per click, oldest first). Amazon/Flipkart often block automated checks, so only "Broken" needs action.
- Product pages show "Price checked on <date>" and warn after 30 days; the date updates when you change a price or tick "re-checked today".
- Email list: the footer form stores consenting sign-ups in `subscribers`; see them and download a CSV at `/admin/subscribers`. Send mail from your own email tool.
- Spam check (optional, free): create a Cloudflare Turnstile widget, then set BOTH `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` and redeploy. It protects the contact and email forms; with only one key set it stays off.
- Google AdSense: three horizontal banner spots, controlled in `/admin/settings` (see `LAUNCH.md`, section 3b). `/ads.txt` is generated from your Publisher ID.
- Home page: Trending/Featured rows (tick the boxes on a product), sorting, a store filter, a deals-only filter and pagination (24 per page).
- Public pages are cached for 60 s and refreshed immediately when you save in admin.
- Never commit `.env.local`; `.gitignore` already excludes it.
- Not yet tested against a live Supabase or Render.

## First-run test checklist (do these once after deploying)
1. `/api/health` returns OK; `/admin/setup` shows every check green (migrations 0001-0006, storage, site URL).
2. `/admin/login`: sign in with Google. A non-admin Google account must be bounced back to the login page.
3. Categories: add a main category and a sub-category.
4. Add a product: photo (try the sticker maker with a photo over 1 MB), brand, specs, price, two buy links (one Amazon, one Flipkart or other). Set it to Published, tick Trending.
5. Home: the product appears in "Trending now"; try the sort, store and deals filters; search for its name.
6. Product page: buy buttons open the retailer, brand and specs show, "Price checked on" shows today's date.
7. `/admin/analytics`: the click you just made appears (open the link in a normal browser, not curl).
8. `/admin/links`: click "Check next 40 links". Amazon/Flipkart showing "Blocked / unknown" is normal.
9. `/contact`: send a message; it appears in `/admin/messages`. Footer: join the email list; it appears in `/admin/subscribers`; download the CSV.
10. Try `/admin/products` in a private window while signed out: you must land on the login page.
11. Delete the test product and categories.

## Speed: how to test it properly

- `npm run dev` is always slow: it compiles each page the first time you open it and does not prefetch links. Judge speed with `npm run build && npm start`.
- Put the web host and the Supabase project in the same region (or as close as possible). Every database call is a network trip, and a page makes several.
- Render's free plan sleeps after 15 minutes without visitors and has a very small CPU, so the first click after a pause is slow. The Starter plan removes the sleep.

## Free-tier hardening (read these before launching)
All guides are in [`docs/`](docs/):
[AUDIT](docs/AUDIT.md) (what was wrong, what changed, what needs your decision) ·
[DEPLOYMENT](docs/DEPLOYMENT.md) (**do the "Before the first deploy" checklist first**) ·
[CLOUDFLARE](docs/CLOUDFLARE.md) · [MONITORING](docs/MONITORING.md) · [BACKUPS](docs/BACKUPS.md) ·
[SECURITY](docs/SECURITY.md) · [TESTING](docs/TESTING.md) · [LIMITATIONS](docs/LIMITATIONS.md) · [UPGRADE_PATH](docs/UPGRADE_PATH.md).

Commands: `npm test` (unit tests) · `npm run typecheck` · `npm run backfill:images` (optimise old images, dry-run by default) ·
`npm run backup:images` · `scripts/backup-db.sh` · `bash scripts/smoke.sh` (needs the mock: `npm run mock:supabase`).
