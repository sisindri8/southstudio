create extension if not exists pgcrypto;

create table admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin','editor')),
  created_at timestamptz not null default now()
);
create function is_admin() returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from admin_profiles where user_id = auth.uid()) $$;

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique, image_url text,
  created_at timestamptz not null default now()
);
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, slug text not null unique, logo_url text,
  created_at timestamptz not null default now()
);
create table retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, logo_url text,
  created_at timestamptz not null default now()
);
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique,
  brand_id uuid references brands(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  short_description text, description text, specifications jsonb not null default '{}',
  main_image_url text,
  price numeric(12,2) check (price >= 0), original_price numeric(12,2) check (original_price >= 0),
  currency text not null default 'INR',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false, trending boolean not null default false,
  seo_title text, seo_description text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on products (status, created_at desc);
create index on products (category_id); create index on products (brand_id);
create index products_search on products using gin (to_tsvector('simple', name || ' ' || coalesce(short_description,'')));

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null, alt text, sort_order int not null default 0
);
create index on product_images (product_id);

create table product_affiliate_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  retailer_id uuid not null references retailers(id) on delete restrict,
  affiliate_url text not null check (affiliate_url ~* '^https?://'),
  display_price numeric(12,2), priority int not null default 0,
  created_at timestamptz not null default now()
);
create index on product_affiliate_links (product_id, priority);

create table affiliate_clicks (
  id bigint generated always as identity primary key,
  link_id uuid references product_affiliate_links(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  retailer_id uuid references retailers(id) on delete set null,
  referrer text, created_at timestamptz not null default now()
);
create index on affiliate_clicks (created_at); create index on affiliate_clicks (product_id);

create table website_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, message text not null, created_at timestamptz not null default now()
);

-- RLS
alter table admin_profiles enable row level security;
alter table categories enable row level security; alter table brands enable row level security;
alter table retailers enable row level security; alter table products enable row level security;
alter table product_images enable row level security; alter table product_affiliate_links enable row level security;
alter table affiliate_clicks enable row level security; alter table website_settings enable row level security;
alter table contact_messages enable row level security;

create policy "self read" on admin_profiles for select using (user_id = auth.uid());
create policy "public read" on categories for select using (true);
create policy "public read" on brands for select using (true);
create policy "public read" on retailers for select using (true);
create policy "public read" on website_settings for select using (true);
create policy "public read published" on products for select using (status = 'published');
create policy "public read images" on product_images for select
  using (exists (select 1 from products p where p.id = product_id and p.status = 'published'));
create policy "public read links" on product_affiliate_links for select
  using (exists (select 1 from products p where p.id = product_id and p.status = 'published'));
create policy "public contact insert" on contact_messages for insert with check (true);

do $$ declare t text; begin
  foreach t in array array['categories','brands','retailers','products','product_images','product_affiliate_links','website_settings','contact_messages','affiliate_clicks'] loop
    execute format('create policy "admin all" on %I for all using (is_admin()) with check (is_admin())', t);
  end loop; end $$;

-- Storage: public-read bucket; writes only via server (service role)
insert into storage.buckets (id, name, public) values ('product-images','product-images', true) on conflict do nothing;
