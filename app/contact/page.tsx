import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { z } from 'zod';
import { admin } from '@/lib/supabase';
import { verifyTurnstile } from '@/lib/turnstile';
import Turnstile from '../Turnstile';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { log } from '@/lib/log';

export const metadata: Metadata = { title: 'Contact us' };

async function send(fd: FormData) {
  'use server';
  if (String(fd.get('website') ?? '')) redirect('/contact?sent=1'); // honeypot: bots see a fake success and nothing is stored
  const ip = clientIp(headers());
  if (!rateLimit('contact', ip, 5, 3600_000).ok) redirect('/contact?e=4'); // 5 messages per hour per visitor
  if (!(await verifyTurnstile(fd.get('cf-turnstile-response'), ip))) redirect('/contact?e=3');
  const r = z.object({
    name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(200),
    message: z.string().trim().min(10).max(3000),
  }).safeParse(Object.fromEntries(fd));
  if (!r.success) redirect('/contact?e=1');
  const { error } = await admin().from('contact_messages').insert({ name: r.data.name, email: r.data.email, message: r.data.message });
  if (error) { log.error('contact.insert_failed', { code: error.code }); redirect('/contact?e=2'); }
  redirect('/contact?sent=1');
}
export default function Contact({ searchParams }: { searchParams: { sent?: string; e?: string } }) {
  return (
    <section className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold uppercase sm:text-4xl">Contact us</h1>
      <p className="mt-3 text-ink/70">Questions, corrections or a product suggestion? Send us a message.</p>
      {searchParams.sent && <p role="status" className="mt-6 bg-lime p-3 text-sm">Thank you. Your message has been sent.</p>}
      {searchParams.e === '1' && <p role="alert" className="mt-6 text-flare">Please check your details. Name, a valid email and a message of at least 10 characters are required.</p>}
      {searchParams.e === '2' && <p role="alert" className="mt-6 text-flare">Sorry, your message could not be sent. Please try again later.</p>}
      {searchParams.e === '4' && <p role="alert" className="mt-6 text-flare">You have sent several messages recently. Please try again later.</p>}
      {searchParams.e === '3' && <p role="alert" className="mt-6 text-flare">Verification failed. Please try again.</p>}
      <form action={send} className="mt-6 space-y-4 border border-line bg-white p-5 sm:p-6">
        <label className="block text-sm font-medium">Name<input name="name" required minLength={2} maxLength={100} autoComplete="name" className="field mt-1" /></label>
        <label className="block text-sm font-medium">Email<input name="email" type="email" required autoComplete="email" className="field mt-1" /></label>
        <label className="block text-sm font-medium">Message<textarea name="message" required minLength={10} maxLength={3000} rows={6} className="field mt-1" /></label>
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <Turnstile />
        <button className="btn">Send message</button>
      </form>
    </section>
  );
}
