// Realistic small-traffic mix. Run against LOCAL/STAGING only; never against production without permission.
//   k6 run -e BASE=http://127.0.0.1:3000 -e VUS=10 -e LINKS=<uuid>,<uuid> loadtest/k6-mix.js
// Each virtual user behaves like a shopper: lands on the home page, browses, opens products, sometimes searches,
// sometimes clicks "Buy" (/go/<id>, redirect NOT followed so we time the redirect itself), then pauses 1-3 s.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 429)); // 429 from our own rate limiter is expected, not a failure

const BASE = __ENV.BASE || 'http://127.0.0.1:3000';
const VUS = Number(__ENV.VUS || 10);
const LINKS = (__ENV.LINKS || '').split(',').filter(Boolean);
const SLUGS = (__ENV.SLUGS || 'product-1,product-2,product-3,product-4,product-5,product-6').split(',');
const TERMS = ['shirt', 'product', 'test', 'black', 'long', 'short'];
const goCount = new Counter('go_requests');
const goTime = new Trend('go_redirect_ms', true), pageOk = new Rate('page_ok');
const UA = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 k6-loadtest-browser' } };

export const options = {
  stages: [{ duration: '10s', target: VUS }, { duration: Number(__ENV.HOLD || 40) + 's', target: VUS }, { duration: '5s', target: 0 }],
  thresholds: { http_req_failed: ['rate<0.01'], 'http_req_duration{kind:page}': ['p(95)<1500'], go_redirect_ms: ['p(95)<300'] },
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export default function () {
  const r = Math.random();
  if (r < 0.30) { const x = http.get(`${BASE}/`, { ...UA, tags: { kind: 'page' } }); pageOk.add(check(x, { 'home 200': (v) => v.status === 200 })); }
  else if (r < 0.65) { const x = http.get(`${BASE}/products/${pick(SLUGS)}`, { ...UA, tags: { kind: 'page' } }); pageOk.add(check(x, { 'product 200': (v) => v.status === 200 })); }
  else if (r < 0.75) { const x = http.get(`${BASE}/?q=${pick(TERMS)}`, { ...UA, tags: { kind: 'search' } }); pageOk.add(check(x, { 'search 200/429': (v) => v.status === 200 || v.status === 429 })); }
  else if (r < 0.85) { const x = http.get(`${BASE}/?cat=fashion&page=${1 + Math.floor(Math.random() * 2)}`, { ...UA, tags: { kind: 'page' } }); pageOk.add(check(x, { 'category 200': (v) => v.status === 200 })); }
  else if (LINKS.length) { const x = http.get(`${BASE}/go/${pick(LINKS)}`, { ...UA, redirects: 0, tags: { kind: 'go' } }); goTime.add(x.timings.duration); goCount.add(1); check(x, { 'go 302': (v) => v.status === 302 }); }
  sleep(1 + Math.random() * 2);
}
