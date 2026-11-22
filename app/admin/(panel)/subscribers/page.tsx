import { admin, requireAdmin } from '@/lib/supabase';
import { deleteSubscriber } from '../actions';
import ConfirmButton from '../ConfirmButton';
import ErrorBanner from '../ErrorBanner';

export const dynamic = 'force-dynamic';

export default async function Subscribers({ searchParams }: { searchParams: { err?: string } }) {
  await requireAdmin();
  const { data, error, count } = await admin().from('subscribers').select('id,email,source,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(500);
  return (
    <div className="max-w-3xl space-y-4 border border-line bg-white p-5 sm:p-6">
      <h1 className="font-display text-3xl font-extrabold uppercase">Email list</h1>
      <ErrorBanner message={searchParams.err ?? (error ? `${error.message}. Run supabase/migrations/0005_subscribers.sql.` : undefined)} />
      <p className="flex flex-wrap items-center gap-4 text-sm">
        <span><strong>{count ?? 0}</strong> subscribers (all gave consent when signing up)</span>
        <a href="/admin/subscribers/export" className="btn">Download CSV</a>
      </p>
      <p className="text-xs text-ink/60">Send mail from your own email tool (Brevo, MailerLite, etc.) using the CSV. When someone asks to unsubscribe through the contact page, delete them here and in that tool.</p>
      <ul className="divide-y divide-line border border-line text-sm">
        {data?.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 p-2">
            <span className="min-w-0 truncate">{s.email}<span className="ml-2 text-xs text-ink/50">{new Date(s.created_at).toLocaleDateString('en-IN')}</span></span>
            <form action={deleteSubscriber}><input type="hidden" name="id" value={s.id} /><ConfirmButton message={`Remove ${s.email} from the list?`} className="text-xs text-flare">Delete</ConfirmButton></form>
          </li>
        ))}
        {!error && !data?.length && <li className="p-3 text-ink/60">No subscribers yet.</li>}
      </ul>
      {(count ?? 0) > 500 && <p className="text-xs text-ink/60">Showing the latest 500. The CSV has everyone.</p>}
    </div>
  );
}
