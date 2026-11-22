# Studio South launch guide

Do these in order. Budget about 60-90 minutes, plus waiting for affiliate approvals.

## 1. Supabase (database, login, image storage)
1. Create a project at supabase.com (pick a region near your visitors, e.g. Mumbai). Save the database password.
2. SQL Editor: run these files from `supabase/migrations/`, one at a time, in order: `0001`, `0002`, `0003`, `0004`, `0005`, `0006`.
3. Project Settings > API: copy the **Project URL**, the **anon key** and the **service_role key**.
   The service_role key is a master key. Only put it in Render's environment settings. Never in git, chat or browser code.
4. Authentication > Providers: enable **Google**, turn **Email** off.
5. Google sign-in needs a Google Cloud OAuth client:
   - console.cloud.google.com > APIs & Services > Credentials > Create OAuth client ID > Web application.
   - Authorized redirect URI: the callback shown on Supabase's Google provider page (looks like `https://<project-ref>.supabase.co/auth/v1/callback`).
   - Paste the Client ID and Secret back into Supabase.
6. Authentication > URL Configuration: set **Site URL** to your live address and add both Redirect URLs:
   `https://YOUR-SITE/auth/callback` and `https://YOUR-SITE/auth/admin/callback`
   (and the `http://localhost:3000` versions while testing locally).
7. Make yourself the admin: sign in once at `/admin/login`, then in the SQL Editor run
   `insert into admin_profiles (user_id) select id from auth.users where email = 'you@gmail.com';`

## 2. GitHub + Render (hosting)
1. Put the project in a **private** GitHub repo. Check `git status` first: `.env.local` and `node_modules` must NOT be listed (the `.gitignore` excludes them). Commit `package-lock.json`.
2. Render > New > Blueprint > pick the repo (it reads `render.yaml`). Fill in the environment variables:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (your real https address, not localhost).
   `NEXT_PUBLIC_*` values are baked in at build time, so set them before the first deploy. If you change one later, redeploy.
3. First deploy takes a few minutes. The free plan sleeps after inactivity, so the first visit after a quiet spell is slow. Upgrade the plan when traffic matters.
4. Open `/admin/setup`. Every line should be green. Then run the **first-run checklist** at the bottom of `README.md`.
5. Custom domain later: add it in Render, then update `NEXT_PUBLIC_SITE_URL`, Supabase Site URL and Redirect URLs, and Google's OAuth settings, and redeploy.

## 3. Before you apply to affiliate programs
Both programs review your site, so launch with real content first: at least 15-20 published products with photos and descriptions, and the legal pages visible (about, contact, privacy, disclosure). Check your own wording on the legal pages: they are templates, not legal advice.

### Amazon Associates (India: affiliate-program.amazon.in)
- Read the Operating Agreement and Participation Requirements on your Associates dashboard. They are the source of truth and change over time.
- Amazon requires you to state: **"As an Amazon Associate I earn from qualifying purchases."** The site already shows this exact sentence in the footer text, on the disclosure page and on product pages with an Amazon link. Keep it unchanged.
- New accounts are generally approved provisionally, then must produce **3 qualifying sales within 180 days** or the account is closed (you can reapply). Your own purchases do not count. Share the site with real people early.
- Use only links created with your own Associates tag, and paste them as they are.
- Not verified, so check before relying on it: (1) whether Amazon accepts links that go through your own `/go/...` redirect (the redirect ends on Amazon with your tag, but confirm with Associates support), and (2) Amazon's rules on showing prices. Prices on the site are typed by you and can go stale; the "Price checked on" date helps but does not replace reading the rule.

### Flipkart Affiliate (affiliate.flipkart.com)
- Flipkart's policy says you apply with "Your site", meaning a website or blog, which you identify in the application. Approval is at their discretion and new or small sites are sometimes declined. If rejected, wait, add content, and reapply.
- A network such as Cuelinks is a common fallback. Links from it often use short domains. The link checker will show those as "Online store".
- Read the program terms before applying (paid-search and trademark rules in particular).

### General
- Indian advertising guidance also expects clear disclosure of paid or affiliate relationships. The site shows a disclosure near every Buy button and in the footer. Do not hide or shrink it.
- Do not use affiliate links in emails to your list or in ads unless the program terms allow it. Read each program's rules on email and paid ads first.

## 3b. Google AdSense (horizontal banner ads only)
The site has three horizontal banner spots. They are switched on from **Admin > Site settings > Google AdSense**, so you never need to redeploy.

**Where the ads go (and why there)**
1. **Home page:** between the Trending/Featured rows and the main product grid. Only shown when those rows exist.
2. **End of product lists** (home, categories, search): below the grid and the Previous/Next buttons, with 48 px of space. Only shown when the page lists 8 or more products.
3. **Product page:** below the whole product block (photos, buy buttons, description, specs) and above "You may also like". Only shown when the product has at least 200 characters of description or 3 specification lines.

**Where there are never ads:** header, menu, carousel, next to Buy buttons, contact, sign-in, account, admin, 404 and error pages, legal pages. Google says to keep links, buttons and Previous/Next controls away from ads, and it does not allow ads on pages without real content. There are no side or sticky ads, so nothing vertical.

**Set-up, in order**
1. Apply at adsense.google.com with your live site address.
2. In Site settings paste your **Publisher ID** (`ca-pub-...`), leave **Show ads** off, and save. This puts the verification tag in every page and publishes `/ads.txt` (Google asks for it). Click Verify in AdSense and wait for review (days to a few weeks).
3. After approval: AdSense > Ads > By ad unit > **Display ads** > create 3 units, each with size **Responsive**. Copy the number in each unit's `data-ad-slot="..."` and paste them into the three fields. Tick **Show ads** and save.
4. AdSense > Sites > your site: turn **Auto ads OFF**. Auto ads can add side rails, sticky bottom ads and full-screen ads, which would break the horizontal-only rule.
5. AdSense > Privacy & messaging: turn on Google's consent message for visitors in Europe and the UK.
6. Check the site in a private window. New ad units can take a few hours to start filling, and blank space collapses by itself until they do.

**How the horizontal part works:** the ad box is full width, up to 970 px wide and a fixed 100 px tall. Only horizontal sizes fit (320x50, 320x100, 468x60, 728x90, 970x90), on phones as well as desktop. Google's plain "horizontal" setting is documented as desktop-only, so this fixed-height version is used instead.

**Approval risk (be realistic):** Google's guidance says not to build "cookie cutter" sites such as affiliate programs with little or no original content, and it does not allow ads on thin or low-value pages. A site that only lists products with short or copied descriptions can be rejected. Before applying, write your own descriptions for your best 15-20 products (150+ words each), and consider a few original buying guides or comparisons. Rejection is not permanent: improve the content and reapply.

**Rules to follow once live**
- Never click your own ads, and never ask visitors to click them (no "support us" or arrows).
- Do not move ads next to buttons or menus, and do not add ads to the error, contact or sign-in pages.
- Keep the cookie and privacy pages as they are: they now mention Google advertising.
- Revenue trade-off: an ad click takes a visitor away from the shop. That is why the product-page ad is below the buy buttons. Watch `/admin/analytics` after turning ads on; if buy-button clicks drop sharply, turn the product-page unit off by clearing its number.

## 3c. Free-tier hardening
Before your first deploy of this version, follow `docs/DEPLOYMENT.md` section 0: run migration `0007` and check your affiliate link domains. Then set up Cloudflare (`docs/CLOUDFLARE.md`), UptimeRobot (`docs/MONITORING.md`) and a weekly backup (`docs/BACKUPS.md`).

## 4. After launch
- Google Search Console: add the site, submit `https://YOUR-SITE/sitemap.xml`.
- Weekly: `/admin/links` (check 40 links; fix only "Broken"), `/admin/analytics`, `/admin/messages`.
- Monthly: re-check prices on top-clicked products and tick "re-checked today".
- Back up: Supabase > Database > Backups (free plans have limited backups; export the CSVs of subscribers occasionally).
- Rotate keys if the service_role key ever leaks: Supabase > Project Settings > API, then update Render.
