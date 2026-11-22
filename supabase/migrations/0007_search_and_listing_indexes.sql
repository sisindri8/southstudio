-- 0007: indexes for search, sorting, store filter and click clean-up.
-- ADDITIVE ONLY: creates an extension and indexes. It does not change, move or delete any data and is safe to re-run.
-- Run it in the Supabase SQL editor. On a small catalogue each index builds in well under a second.
-- (We avoid CREATE INDEX CONCURRENTLY because the SQL editor wraps statements in a transaction.)

-- 1) Search. The app searches with  name/short_description/description ILIKE '%text%'.
--    The existing "products_search" full-text index can NOT serve ILIKE, so every search scanned the whole table.
--    Trigram indexes make '%text%' searches indexable (for 3+ characters) while keeping the exact same matching behaviour.
create extension if not exists pg_trgm with schema extensions;
create index if not exists products_name_trgm       on products using gin (name              extensions.gin_trgm_ops);
create index if not exists products_shortdesc_trgm  on products using gin (short_description extensions.gin_trgm_ops);
create index if not exists products_desc_trgm       on products using gin (description       extensions.gin_trgm_ops);

-- 2) Sorting the public listing. Partial indexes (published rows only) match the queries exactly, including NULLS LAST
--    and the created_at tie-breaker, so ORDER BY ... LIMIT 24 reads 24 index entries instead of sorting everything.
create index if not exists products_pub_price_asc  on products (price asc  nulls last, created_at desc) where status = 'published';
create index if not exists products_pub_price_desc on products (price desc nulls last, created_at desc) where status = 'published';
create index if not exists products_pub_discount   on products (discount_pct desc nulls last, created_at desc) where status = 'published';
create index if not exists products_pub_cat_new    on products (category_id, created_at desc) where status = 'published';

-- 3) Store filter: product_affiliate_links had only (product_id, priority), so filtering by retailer scanned every link.
create index if not exists links_retailer_product on product_affiliate_links (retailer_id, product_id);

-- 4) Foreign keys from affiliate_clicks (ON DELETE SET NULL) had no index: every time a link/product/retailer is deleted
--    (the admin "save product" screen deletes and re-creates links) Postgres scanned the whole, ever-growing clicks table.
create index if not exists clicks_link_id     on affiliate_clicks (link_id);
create index if not exists clicks_retailer_id on affiliate_clicks (retailer_id);

analyze products; analyze product_affiliate_links; analyze affiliate_clicks;

-- OPTIONAL, NOT executed: the old full-text index is unused by the app. Drop it only after you have confirmed nothing else uses it.
-- drop index if exists products_search;
