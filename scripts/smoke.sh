#!/usr/bin/env bash
# Black-box regression suite. Needs the app running against the MOCK Supabase (see docs/TESTING.md):
#   node scripts/mock-supabase.mjs &      (port 54321)   then build/start the app with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   BASE=http://127.0.0.1:3000 bash scripts/smoke.sh
# Never run this against production: it injects failures into the mock only, but it assumes the mock's fixture data.
B=${BASE:-http://127.0.0.1:3000}; M=${MOCK:-http://127.0.0.1:54321}; UA='Mozilla/5.0 Chrome/120'
L1=00000000-0000-4000-8000-000500000001; pass=0; fail=0
ok(){ if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "  PASS $1"; else fail=$((fail+1)); echo "  FAIL $1 (expected '$3', got '$2')"; fi; }
code(){ curl -s -o /dev/null -w "%{http_code}" "$@"; }
ctl(){ curl -s -XPOST $M/__ctl -d "$1" >/dev/null; }
sess(){ python3 -c "import urllib.parse;print('sb-127-auth-token='+urllib.parse.quote('{\"access_token\":\"$1\",\"refresh_token\":\"r\",\"expires_at\":4102444800,\"expires_in\":3600,\"token_type\":\"bearer\",\"user\":{\"id\":\"u\"}}'))"; }
echo "== pages"; ok "home 200" "$(code $B/)" 200; ok "product 200" "$(code $B/products/product-1)" 200
ok "missing product is a real 404" "$(code $B/products/nope)" 404; ok "draft product 404" "$(code $B/products/product-31)" 404
ok "category 200" "$(code "$B/?cat=fashion")" 200; ok "page 2 200" "$(code "$B/?page=2")" 200; ok "sort/deals/retailer 200" "$(code "$B/?sort=price_asc&deals=1&retailer=Amazon")" 200
ok "array param no crash" "$(code "$B/?q=a&q=b")" 200; ok "garbage params no crash" "$(code "$B/?page=abc&sort=zz&cat=%00")" 200
ok "search finds the product" "$([ "$(curl -s "$B/?q=Test+Product+7" | grep -c 'Test Product 7')" -gt 0 ] && echo yes || echo no)" yes
ok "search with no match shows none" "$(curl -s "$B/?q=zzzqqq" | grep -c 'Test Product')" 0
ok "sitemap 200" "$(code $B/sitemap.xml)" 200; ok "robots 200" "$(code $B/robots.txt)" 200
ok "sitemap lacks drafts" "$(curl -s $B/sitemap.xml | grep -c product-31)" 0
echo "== SEO"; ok "search page noindex" "$(curl -s "$B/?q=shirt" | grep -c 'name="robots" content="noindex')" 1
ok "sorted page noindex" "$(curl -s "$B/?sort=price_asc" | grep -c 'name="robots" content="noindex')" 1
ok "home indexable" "$(curl -s $B/ | grep -c 'content="noindex')" 0; ok "category indexable" "$(curl -s "$B/?cat=fashion" | grep -c 'content="noindex')" 0
ok "product has canonical" "$(curl -s $B/products/product-1 | grep -c 'rel="canonical"')" 1
echo "== affiliate redirect"; ok "302" "$(code -A "$UA" $B/go/$L1)" 302
ok "tag preserved" "$(curl -s -o /dev/null -D - -A "$UA" $B/go/$L1 | grep -ic 'location: https://www.amazon.in/dp/B01?tag=studio-21&utm_source=ss')" 1
ok "no-store" "$(curl -s -o /dev/null -D - -A "$UA" $B/go/$L1 | grep -ic 'cache-control: private, no-store')" 1
ok "unapproved host blocked" "$(code -A "$UA" $B/go/00000000-0000-4000-8000-000500000028)" 404
ok "unknown id 404" "$(code -A "$UA" $B/go/00000000-0000-4000-8000-000500009999)" 404; ok "bad id 404" "$(code $B/go/not-a-uuid)" 404
ok "draft product link 404" "$(code -A "$UA" $B/go/00000000-0000-4000-8000-000500000031)" 404
sleep 1.5; curl -s -XPOST $M/__stats/reset >/dev/null; curl -s -o /dev/null -A "Googlebot/2.1" $B/go/$L1; sleep 1
ok "bot not counted" "$(curl -s $M/__stats | python3 -c 'import sys,json;print(json.load(sys.stdin)["rest"].get("affiliate_clicks",0))')" 0
curl -s -o /dev/null -A "$UA" $B/go/$L1; sleep 1.2
ok "real click counted (async)" "$(curl -s $M/__stats | python3 -c 'import sys,json;print(json.load(sys.stdin)["rest"].get("affiliate_clicks",0))')" 1
ctl '{"mode":"ok","delayMs":400}'; T=$(curl -s -o /dev/null -A "$UA" -w "%{time_total}" $B/go/$L1); ctl '{"mode":"ok","delayMs":0}'
ok "cached redirect fast despite slow DB (<0.1s)" "$(python3 -c "print('yes' if $T<0.1 else 'no')")" yes
echo "== outages"; ctl '{"mode":"503"}'
ok "product during outage is 5xx not 404" "$(code $B/products/product-12 | cut -c1)" 5; SM=$(curl -s -w ' %{http_code}' $B/sitemap.xml); ok "sitemap in outage is a 5xx or the cached full sitemap, never an empty 200" "$( ( [ "${SM##* }" -ge 500 ] || echo "$SM" | grep -q '/products/' ) && echo yes || echo no)" yes
ok "warmed /go keeps redirecting" "$(code -A "$UA" $B/go/$L1)" 302; ok "unseen /go during outage is 503" "$(code -A "$UA" $B/go/00000000-0000-4000-8000-000500000020)" 503
ok "health (liveness) unaffected" "$(code $B/api/health)" 200; ok "health/db reports 503" "$(code $B/api/health/db)" 503
ok "saved w/ valid session + auth down = 503" "$(code -H "Cookie: $(sess good-token)" $B/api/saved)" 503
ctl '{"mode":"ok"}'; ok "recovers immediately" "$(code $B/products/product-12)" 200
echo "== saved items"; curl -s -XPOST $M/__stats/reset >/dev/null
ok "signed-out: no cookie -> signedIn false" "$(curl -s $B/api/saved | grep -c '"signedIn":false')" 1
ok "signed-out costs 0 DB/auth calls" "$(curl -s $M/__stats | python3 -c 'import sys,json;print(json.load(sys.stdin)["total"])')" 0
ok "valid session -> ids" "$(curl -s -H "Cookie: $(sess good-token)" $B/api/saved | grep -c '"signedIn":true')" 1
ok "expired session -> signed out" "$(curl -s -H "Cookie: $(sess bad)" $B/api/saved | grep -c '"signedIn":false')" 1
ok "saved is private no-store" "$(curl -s -D - -o /dev/null $B/api/saved | grep -ic 'cache-control: private, no-store')" 1
echo "== admin / auth"; ok "admin redirects to login" "$(code $B/admin/products)" 307; ok "admin/login reachable" "$(code $B/admin/login)" 200
ok "admin with admin session" "$(code -H "Cookie: $(sess admin-token)" $B/admin/products)" 200
ok "admin no-store" "$(curl -s -D - -o /dev/null -H "Cookie: $(sess admin-token)" $B/admin/products | grep -ic 'cache-control: private, no-store')" 1
ok "shopper session is not admin (no data page)" "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: $(sess good-token)" $B/admin/products | cut -c1)" 3
echo "== hardening"; ok "/_next/image disabled" "$(code "$B/_next/image?url=%2Ficon.png&w=640&q=75")" 404
head -c 200000 /dev/zero | tr '\0' a > /tmp/big.bin; ok "oversized public POST 413" "$(code -X POST -H 'Next-Action: x' --data-binary @/tmp/big.bin $B/contact)" 413
ok "no X-Powered-By" "$(curl -s -D - -o /dev/null $B/ | grep -ic x-powered-by)" 0; ok "frame protection" "$(curl -s -D - -o /dev/null $B/ | grep -ic 'x-frame-options: DENY')" 1
echo "== rate limit (30 searches/min/IP; uses a spoofed test IP)"; n=0; for i in $(seq 1 34); do c=$(code -H "X-Forwarded-For: 198.51.100.77" "$B/?q=rl$i"); [ "$c" = 429 ] && n=$((n+1)); done
ok "searches beyond 30 get 429" "$([ $n -ge 3 ] && echo yes || echo no)" yes; ok "other IP unaffected" "$(code -H 'X-Forwarded-For: 198.51.100.78' "$B/?q=ok")" 200
echo; echo "RESULT: $pass passed, $fail failed"; [ $fail -eq 0 ]
