import { getSite } from '@/lib/site';

export const revalidate = 60;
// Google's ads.txt line for AdSense. f08c47fec0942fa0 is Google's fixed certification authority ID.
export async function GET() {
  const { ads } = await getSite();
  const id = ads.client.replace(/^ca-/, '');
  if (!/^pub-\d{10,20}$/.test(id)) return new Response('Not found', { status: 404 });
  return new Response(`google.com, ${id}, DIRECT, f08c47fec0942fa0\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
