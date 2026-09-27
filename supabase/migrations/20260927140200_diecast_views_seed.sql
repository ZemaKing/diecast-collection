-- Phase 6 · 3/3 — read view for the collection list + lookup seed.

-- One row per model with everything the collection grid/filters need (getModels(), Phase 9).
-- security_invoker: the caller's RLS applies, so anon never sees drafts through the view.
create view diecast.model_summaries
with (security_invoker = true)
as
select
    m.id,
    m.slug,
    m.name,
    m.year,
    m.scale,
    m.is_racing,
    m.car_number,
    m.livery_hex,
    m.team,
    m.event,
    m.series,
    m.condition,
    m.location,
    m.added_at,
    m.is_published,
    m.created_at,
    m.updated_at,
    b.slug        as brand_slug,
    b.name        as brand_name,
    b.logo_path   as brand_logo_path,
    mf.slug       as manufacturer_slug,
    mf.name       as manufacturer_name,
    mf.logo_path  as manufacturer_logo_path,
    c.slug        as category_slug,
    c.name        as category_name,
    c.sort_order  as category_sort_order,
    d.slug        as driver_slug,
    d.name        as driver_name,
    d.country_code as driver_country_code,
    coalesce(colors.slugs, '{}') as color_slugs,
    coalesce(colors.names, '{}') as color_names,
    img.storage_path        as image_storage_path,
    img.external_url        as image_external_url,
    img.thumb_storage_path  as thumb_storage_path,
    img.thumb_external_url  as thumb_external_url,
    img.width               as image_width,
    img.height              as image_height,
    coalesce(img_count.n, 0) as image_count
from diecast.models m
join diecast.brands b         on b.id = m.brand_id
join diecast.manufacturers mf on mf.id = m.manufacturer_id
join diecast.categories c     on c.id = m.category_id
left join diecast.drivers d   on d.id = m.driver_id
left join lateral (
    select array_agg(col.slug order by mc.position) as slugs,
           array_agg(col.name order by mc.position) as names
    from diecast.model_colors mc
    join diecast.colors col on col.id = mc.color_id
    where mc.model_id = m.id
) colors on true
left join lateral (
    select i.storage_path, i.external_url, i.thumb_storage_path, i.thumb_external_url, i.width, i.height
    from diecast.model_images i
    where i.model_id = m.id
    order by i.is_primary desc, i.position
    limit 1
) img on true
left join lateral (
    select count(*)::int as n from diecast.model_images i where i.model_id = m.id
) img_count on true;

grant select on diecast.model_summaries to anon, authenticated, service_role;

-- Categories are fixed by the data today (docs/SCHEMA.md §4.3); colors, brands, etc. come from the importer.
insert into diecast.categories (slug, name, sort_order) values
    ('rally',    'Rally',    10),
    ('racing',   'Racing',   20),
    ('supercar', 'Supercar', 30),
    ('premium',  'Premium',  40),
    ('retro',    'Retro',    50)
on conflict (slug) do nothing;
