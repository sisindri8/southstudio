'use server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { admin } from '@/lib/supabase';
import { verifyTurnstile } from '@/lib/turnstile';
import { clientIp, rateLimit } from '@/lib/ratelimit';

export type SubResult = { ok: boolean; message: string };
const OK = { ok: true, message: 'Thanks! You are on the list.' };

export async function subscribe(fd: FormData): Promise<SubResult> {
  if (String(fd.get('website') ?? '')) return OK; // honeypot: bots see success, nothing is stored
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(fd.get('email'));
  if (!email.success) return { ok: false, message: 'Please enter a valid email address.' };
  if (fd.get('consent') !== 'on') return { ok: false, message: 'Please tick the box to agree to receive deal emails.' };
  const ip = clientIp(headers());
  if (!rateLimit('subscribe', ip, 10, 3600_000).ok) return { ok: false, message: 'Too many attempts. Please try again later.' };
  if (!(await verifyTurnstile(fd.get('cf-turnstile-response'), ip))) return { ok: false, message: 'Verification failed. Please try again.' };
  const db = admin();
  // Crude flood guard: refuse if the list grew by 100+ in the last 10 minutes.
  const { count } = await db.from('subscribers').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 600_000).toISOString());
  if ((count ?? 0) >= 100) return { ok: false, message: 'Too many sign-ups right now. Please try again later.' };
  const { error } = await db.from('subscribers').insert({ email: email.data, source: 'footer' });
  if (error && error.code !== '23505') return { ok: false, message: 'Sorry, we could not sign you up. Please try again later.' }; // 23505 = already subscribed: same friendly reply
  return OK;
}
