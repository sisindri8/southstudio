# Cloudflare Free: what to click

**Nothing here happens automatically.** Changing the code does not configure Cloudflare. Dashboard labels move around; if a name differs, search the dashboard for the setting. I could not log in to your account, so these steps were written from Cloudflare's documentation, not tested on your zone.

## What Cloudflare will and will not do for you

- **Will:** cache static files (`/_next/static/*`, icons), terminate SSL, absorb junk traffic, give you rate-limiting and bot tools.
- **Will not:** speed up images. Product images live on **Supabase's own CDN** (`<project>.supabase.co`), which is not behind your Cloudflare zone. Their bandwidth is controlled by the WebP sizes and the one-year `Cache-Control` the app now sets, not by Cloudflare.
- **Should not:** cache HTML. Pages are already cheap at the origin (60 s data cache). Caching HTML at the edge is a later experiment, see "Phase 2".

## Step 1: put the domain on Cloudflare

1. Add your domain (Websites > Add a site > Free). Change the nameservers at your registrar as instructed.
2. DNS: create `CNAME  www  ->  <your-service>.onrender.com` and the apex record Render documents, **Proxied (orange cloud)**. In Render > Settings > Custom Domains, add the domain and let it verify.
3. SSL/TLS > Overview: **Full (strict)** (Render serves a valid certificate).
4. SSL/TLS > Edge Certificates: **Always Use HTTPS** on. (Do not enable the broad "HSTS preload" until you are sure; the app already sends HSTS.)
5. In Render set `TRUST_CF_CONNECTING_IP=1` and `NEXT_PUBLIC_SITE_URL=https://yourdomain` and redeploy. This makes the app's own rate limits use the real visitor IP.

## Step 2: caching rules (Caching > Cache Rules > Create rule)

**Rule A: static assets (cache hard)**
- When: `URI Path` `starts with` `/_next/static/`
- Then: Cache eligibility **Eligible for cache**; Edge TTL **Use cache-control header if present** (Next sends one year + immutable); Browser TTL **Respect origin**.

**Rule B: icons and files in /public (cache 1 day)**
- When: `URI Path` `is in` `/icon.png /apple-icon.png /favicon.ico`, or `URI Path` `ends with` `.png` / `.svg` / `.webp` (only if you store your own static files there)
- Then: Eligible for cache; Edge TTL **1 day**.

**Rule C: never cache private or dynamic paths (belt and braces)**
- When (Edit expression):
  `starts_with(http.request.uri.path, "/admin") or starts_with(http.request.uri.path, "/api/") or starts_with(http.request.uri.path, "/auth/") or starts_with(http.request.uri.path, "/go/") or http.request.uri.path eq "/login" or http.request.uri.path eq "/account"`
- Then: Cache eligibility **Bypass cache**.
- Put Rule C **first** in the list (rules are evaluated top to bottom).

Do **not** create a "Cache Everything" rule for the whole site. It would cache `/go/*` redirects (clicks would stop being counted), personalised responses and error pages.

### Verify (do this, do not assume)
```bash
curl -sI https://yourdomain/_next/static/chunks/main-app-XXXX.js | grep -i cf-cache-status   # run twice: MISS then HIT
curl -sI https://yourdomain/api/health | grep -iE "cf-cache-status|cache-control"             # DYNAMIC or BYPASS; no-store
curl -sI -A "Mozilla/5.0" https://yourdomain/go/<a-link-id> | grep -iE "^location|cf-cache-status|cache-control"  # 302, your tag intact, not HIT
curl -sI https://yourdomain/admin | grep -iE "cache-control|cf-cache-status"                  # no-store, not HIT
```
(Find a real `main-app-*.js` name in the page source.)

## Step 3: rate limiting (Security > WAF > Rate limiting rules)

The Free plan allows very few rules (my research found **one** rule with a short counting window; confirm in your dashboard). Use it for the most expensive thing, search + sign-in + contact in one rule:

- When (Edit expression):
  `(http.request.uri.path eq "/" and http.request.uri.query contains "q=") or starts_with(http.request.uri.path, "/auth/") or http.request.uri.path eq "/contact"`
- Counting characteristic: **IP**. Requests: about **20** per the shortest period allowed (10 s). Action: **Block** for the shortest duration allowed.
- The app has its own limits as a second layer (search 30/min/IP etc.), see `SECURITY.md`. Cloudflare's is the one that stops floods *before* they reach Render.

## Step 4: bot protection

1. Security > Bots > **Bot Fight Mode: On**. Caveat: on Free it **cannot be skipped by custom rules**, so it can challenge uptime monitors. Therefore point UptimeRobot at the `onrender.com` address (not your domain), or test and turn Bot Fight Mode off if monitors get blocked. Googlebot and other verified bots are not challenged.
2. Security > Settings > Security level: **Medium**. Leave "Browser Integrity Check" on.
3. Security > WAF > Managed rules: enable the **Cloudflare managed ruleset** available on Free.
4. Turn on **Turnstile** (free) for the contact and newsletter forms: create a widget, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Render. The code already supports it.

## Step 5: limits you should know

- Anyone who learns your `onrender.com` address can bypass Cloudflare and hit the origin directly (Render Free cannot restrict origin access to Cloudflare IPs). The app-level limits still apply, but spoofed headers can evade them. Do not publish the `onrender.com` URL; consider a secret-header check later (see `LIMITATIONS.md`).
- Affiliate redirects: `/go/*` is excluded from caching; tracking parameters are untouched by Cloudflare unless you add Transform Rules (don't).

## Phase 2 (optional, only with data)

If Render CPU becomes the bottleneck, test caching `/products/*` for 60 s with "Respect origin TTL" on **one** product first, and confirm `cf-cache-status` and that the page contains nothing user-specific (hearts load separately from `/api/saved`, which is never cached). Roll back by disabling the rule.
