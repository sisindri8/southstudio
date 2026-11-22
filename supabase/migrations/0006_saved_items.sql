-- Saved items (the heart on product cards). One row per signed-in customer + product.
-- Each customer can only see, add and remove their own rows (row level security).
create table if not exists saved_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists saved_items_user_created on saved_items (user_id, created_at desc);
alter table saved_items enable row level security;
grant select, insert, delete on saved_items to authenticated;
drop policy if exists "own saved read" on saved_items;
drop policy if exists "own saved add" on saved_items;
drop policy if exists "own saved remove" on saved_items;
create policy "own saved read" on saved_items for select using (user_id = auth.uid());
create policy "own saved add" on saved_items for insert with check (user_id = auth.uid());
create policy "own saved remove" on saved_items for delete using (user_id = auth.uid());
