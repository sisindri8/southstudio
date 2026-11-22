import { admin, requireAdmin } from '@/lib/supabase';
import { deleteMessage } from '../actions';
import ConfirmButton from '../ConfirmButton';
import ErrorBanner from '../ErrorBanner';

export default async function Messages({ searchParams }: { searchParams: { err?: string } }) {
  await requireAdmin();
  const { data, error } = await admin().from('contact_messages').select('id,name,email,message,created_at').order('created_at', { ascending: false }).limit(200);
  return (
    <div className="max-w-3xl space-y-4 border border-line bg-white p-5 sm:p-6">
      <h1 className="font-display text-3xl font-extrabold uppercase">Messages</h1>
      <ErrorBanner message={searchParams.err ?? error?.message} />
      {!error && !data?.length && <p className="text-sm text-ink/60">No messages yet.</p>}
      <ul className="divide-y divide-line border border-line">
        {data?.map((m) => (
          <li key={m.id} className="space-y-1 p-3 text-sm">
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span><strong>{m.name}</strong> · <a className="underline" href={`mailto:${m.email}`}>{m.email}</a></span>
              <span className="text-xs text-ink/60">{new Date(m.created_at).toLocaleString('en-IN')}</span>
            </p>
            <p className="whitespace-pre-line text-ink/80">{m.message}</p>
            <form action={deleteMessage}><input type="hidden" name="id" value={m.id} />
              <ConfirmButton message="Delete this message?" className="text-xs text-flare">Delete</ConfirmButton></form>
          </li>
        ))}
      </ul>
    </div>
  );
}
