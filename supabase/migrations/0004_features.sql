-- Price freshness, link-check results, discount sorting and click reports.
alter table products add column if not exists price_checked_at timestamptz;
update products set price_checked_at = coalesce(updated_at, created_at) where price_checked_at is null and price is not null;

-- Stored discount % so the site can sort and filter by "biggest discount" in the database.
alter table products add column if not exists discount_pct int
  generated always as (case when price is not null and original_price is not null and original_price > price and original_price > 0
                            then round((1 - price / original_price) * 100)::int end) stored;
create index if not exists products_discount on products (discount_pct desc nulls last);
create index if not exists products_featured on products (featured, trending) where status = 'published';

alter table product_affiliate_links add column if not exists last_status int;
alter table product_affiliate_links add column if not exists last_error text;
alter table product_affiliate_links add column if not exists last_checked_at timestamptz;

-- Click reports (called by the server with the service role only).
create or replace function click_report(days int)
returns table(kind text, id uuid, name text, clicks bigint)
language sql security definer stable set search_path = public as $$
  select 'product'::text, p.id, p.name, count(*) from affiliate_clicks c join products p on p.id = c.product_id
   where c.created_at > now() - make_interval(days => days) group by p.id, p.name
  union all
  select 'retailer'::text, r.id, r.name, count(*) from affiliate_clicks c join retailers r on r.id = c.retailer_id
   where c.created_at > now() - make_interval(days => days) group by r.id, r.name
$$;
create or replace function click_daily(days int)
returns table(day date, clicks bigint)
language sql security definer stable set search_path = public as $$
  select d::date, coalesce(n.clicks, 0)
  from generate_series((now() - make_interval(days => days - 1))::date, now()::date, interval '1 day') d
  left join (select created_at::date as day, count(*) as clicks from affiliate_clicks
              where created_at > now() - make_interval(days => days) group by 1) n on n.day = d::date
  order by 1
$$;
revoke execute on function click_report(int), click_daily(int) from public, anon, authenticated;
grant execute on function click_report(int), click_daily(int) to service_role;
