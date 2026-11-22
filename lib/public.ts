import { createClient } from '@supabase/supabase-js';

// Every database call gets a hard timeout so a slow or paused Supabase can never hang a page or a redirect.
const TIMEOUT_MS = 8000;

// Cookie-free read client for public pages. Responses are cached for 60 s and purged by revalidateTag('db') after admin saves.
// Failed responses are never stored by Next's data cache, and callers must treat `error` as "service problem", not "no rows".
export const pub = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
  global: { fetch: (u: any, o: any) => fetch(u, { ...o, signal: o?.signal ?? AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: 60, tags: ['db'] } } as any) },
});

// Same read-only anon client but NEVER cached. Used where freshness or cache growth matters:
//  * /go (affiliate URL lookup): an edited or unpublished link must take effect immediately
//  * free-text search: every distinct search string would otherwise add a permanent file to the on-disk data cache
export const pubFresh = (timeoutMs = 4000) => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
  global: { fetch: (u: any, o: any) => fetch(u, { ...o, signal: o?.signal ?? AbortSignal.timeout(timeoutMs), cache: 'no-store' } as any) },
});
