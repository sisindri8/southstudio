alter table categories add column if not exists parent_id uuid references categories(id) on delete cascade;
alter table categories add column if not exists sort_order int not null default 0;
create index if not exists categories_parent on categories (parent_id);

-- Remove the old sample categories, but only untouched ones (no photo, no products), so re-running is safe.
delete from categories c
where c.slug in ('football','cricket','running','gym-fitness','basketball','sportswear','sports-shoes','accessories')
  and c.parent_id is null and c.image_url is null
  and not exists (select 1 from products p where p.category_id = c.id);

insert into categories (name, slug, sort_order) values
 ('Fashion','fashion',1),('Apparel','apparel',2),('Electronics','electronics',3),
 ('Home & Garden','home-garden',4),('Beauty','beauty',5),('Sports','sports',6)
on conflict (slug) do nothing;

insert into categories (name, slug, parent_id, sort_order)
select v.n, v.s, c.id, v.o from (values
  ('Men','fashion-men','fashion',1),('Women','fashion-women','fashion',2),
  ('Men','apparel-men','apparel',1),('Women','apparel-women','apparel',2)
) as v(n,s,p,o) join categories c on c.slug = v.p
on conflict (slug) do nothing;
