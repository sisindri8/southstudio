import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return {
    rules: [{
      userAgent: '*', allow: '/',
      // Search results and filter/sort combinations are duplicates of the main listing: keep crawlers (and their load) out.
      // (The pages also carry noindex,follow, which covers crawlers that ignore these patterns.)
      disallow: ['/admin', '/go/', '/auth/', '/api/', '/account', '/login', '/*?q=', '/*&q=', '/*?*sort=', '/*?*deals=', '/*?*retailer='],
    }],
    sitemap: `${site}/sitemap.xml`,
  };
}
