const noStore = [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }];
export default {
  // Admin forms upload up to ~6 images of 5 MB each in one request; Next's default limit is 1 MB.
  // (Public form posts are capped much lower in middleware.ts.)
  experimental: { serverActions: { bodySizeLimit: '35mb' }, serverComponentsExternalPackages: ['sharp'] },
  // Images are converted to WebP once, at upload (lib/images.ts), so Next's runtime image optimizer is switched OFF:
  // it would cost CPU on Render Free and its /_next/image endpoint is a known abuse and disk-growth target.
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/(.*)', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ]},
      // Private or dynamic areas: tell browsers AND Cloudflare never to store them.
      { source: '/admin/:path*', headers: noStore }, { source: '/auth/:path*', headers: noStore },
      // /api/* and /go/* set their own Cache-Control in code.
      { source: '/account', headers: noStore }, { source: '/login', headers: noStore },
    ];
  },
};
