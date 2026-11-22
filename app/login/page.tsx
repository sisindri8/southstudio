import { redirect } from 'next/navigation';
import { sb } from '@/lib/supabase';
import GoogleButton from '@/app/GoogleButton';

export default async function Login({ searchParams }: { searchParams: { e?: string } }) {
  const { data: { user } } = await sb().auth.getUser();
  if (user) redirect('/account');
  return (
    <div className="mx-auto max-w-sm space-y-4 px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold uppercase">Sign in</h1>
      <p className="text-sm text-ink/70">Sign in with Google. No password needed.</p>
      {searchParams.e && <p role="alert" className="text-flare">Sign in failed. Please try again.</p>}
      <GoogleButton callback="/auth/callback" />
    </div>
  );
}
