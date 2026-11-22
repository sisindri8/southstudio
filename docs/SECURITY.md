# Security and abuse protection

## Rate limits (in the app)
| What | Limit (per IP) | Where | Response |
|---|---|---|---|
| Search (`/?q=`) | 30 / minute | `middleware.ts` | 429 + `Retry-After` |
| Sign-in callbacks (`/auth/*`) | 20 / minute | `middleware.ts` | 429 |
| Public form/heart posts (server actions outside `/admin`) | 60 / minute, body < 64 KB | `middleware.ts` | 429 / 413 |
| Contact form | 5 / hour | `app/contact/page.tsx` | friendly message |
| Newsletter | 10 / hour | `app/subscribe/actions.ts` | friendly message |
| Saved-items API | 120 / minute | `app/api/saved/route.ts` | 429 |
| Subscriber export (admin) | 10 / 10 min | export route | 429 |
| Click **counting** on `/go` | 120 / minute | `/go` route | click not counted, **redirect still happens** |
| `/api/health/db` | 30 / minute | route | 429 |

Admin endpoints require a signed-in admin at three layers (middleware session check, `requireAdmin()` in every page/action: all 9 actions verified, and database RLS).

## Honest limits of in-memory rate limiting
- State lives in one Node process. It **resets** on every restart, deploy and Render Free spin-down, and is **not shared** between instances. With 2+ instances the effective limit multiplies. This is not distributed rate limiting.
- The IP comes from request headers. With `TRUST_CF_CONNECTING_IP=1` the app trusts `CF-Connecting-IP`, which is only trustworthy when traffic really comes through Cloudflare. Anyone who reaches the `onrender.com` origin directly can forge headers and dodge limits. So these limits are *abuse mitigation*, not a security boundary. Cloudflare's rate-limit rule (see `CLOUDFLARE.md`) is the first line of defence.
- Next's middleware runs in a separate sandbox from route handlers; every bucket is used in only one place so counters are never split.
- Chunked uploads without a `Content-Length` header skip the 64 KB middleware check; Next's own 35 MB action limit still applies (it is global because admins upload images).

## Redirect safety (`/go/<id>`)
- The destination is never taken from the request; only a UUID is. The URL comes from the database, which only admins can write.
- Defence in depth (`lib/affiliate.ts`, applied when saving a product **and** on every redirect): `http`/`https` only; no embedded credentials; no IP addresses, `localhost`, `.local`, `.internal`; hostname must be on the approved list (suffix match, so `amazon.in.evil.com` and `evilamazon.in` are refused: unit-tested). Policy: `AFFILIATE_HOST_POLICY` = `enforce` (default) / `warn` / `off`.
- Query strings (your affiliate tag, UTM, etc.) pass through untouched.
- 302 status kept; response is `private, no-store` so browsers/Cloudflare never cache a redirect (every click reaches the server).

## Uploads
Decoded and re-encoded by Sharp, never stored as received: real JPEG/PNG/WebP only (SVG, GIF, animated and disguised files rejected), 5 MB, 24 megapixels (stops decompression bombs), EXIF/GPS removed. Unit-tested with an SVG disguised as JPEG, a text file, a truncated file and a 30000x1000 pixel bomb; end-to-end tested through the real admin action.

## Secrets
- `SUPABASE_SERVICE_ROLE_KEY` is used only in server code (`lib/supabase.ts` -> admin actions and the click writer). Verified: not imported by any `'use client'` file and absent from the built browser bundles.
- `NEXT_PUBLIC_*` values (Supabase URL, anon key, site URL, Turnstile **site** key) are public by design. The anon key's power is limited by Row Level Security: keep RLS enabled (the migrations enable it).
- Errors: users see generic pages; details go to logs, which redact secrets and e-mail addresses.

## Headers
`X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS, `Permissions-Policy`; `X-Powered-By` removed; private areas `no-store`.
**Not added:** a Content-Security-Policy. AdSense, Turnstile and inline scripts make a correct CSP a project of its own; adding a wrong one would break ads or forms.

## Known residual risks (not fixed)
- `npm audit` reports advisories in Next 14.x that are fixed only in 15/16 (e.g. RSC deserialization DoS). The two image-optimizer advisories are neutralised by `images.unoptimized`. The upgrade is a major version: needs your approval and a regression pass.
- The admin "check links" tool follows redirects from admin-entered URLs (SSRF-style risk is low: admin-only, and new links are host-validated).
- `siteOrigin()` in the auth callbacks trusts `x-forwarded-host`; low impact (response goes to the requester) but pin it to `NEXT_PUBLIC_SITE_URL` when convenient.
