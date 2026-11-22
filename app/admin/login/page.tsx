import GoogleButton from '@/app/GoogleButton';

export default function AdminLogin({ searchParams }: { searchParams: { e?: string } }) {
  return (
    <div className="mx-auto max-w-sm space-y-4 px-4 py-12">
      <h1 className="font-display text-3xl font-extrabold uppercase">Admin sign in</h1>
      {searchParams.e === '2' && <p role="alert" className="text-flare">This Google account is not authorized as an admin.</p>}
      {searchParams.e === '1' && <p role="alert" className="text-flare">Sign in failed. Please try again.</p>}
      <GoogleButton callback="/auth/admin/callback" />
    </div>
  );
}
