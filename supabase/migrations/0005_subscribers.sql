-- Email list for the footer sign-up. Written by the server (service role); never readable or writable with the public key.
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) <= 200 and email = lower(email)),
  source text not null default 'footer',
  created_at timestamptz not null default now()
);
create index if not exists subscribers_created on subscribers (created_at desc);
alter table subscribers enable row level security;
drop policy if exists "admin all" on subscribers;
create policy "admin all" on subscribers for all using (is_admin()) with check (is_admin());
