-- Query plans for the app's reads (ROADMAP Phase 33). Read-only — paste into the dashboard's SQL
-- editor and run as one script; it runs as the `anon` role (what a visitor's requests use, RLS
-- included) and rolls back. Results are recorded in docs/performance.md § Database.
--
-- What to expect at ~230 models: sequential scans on `models` and the lookup tables — the planner
-- rightly prefers them over an index for a few hundred rows — and index scans for the per-model
-- lookups (models.slug is UNIQUE; every child table's key starts with model_id). Execution time in
-- single-digit milliseconds. Revisit if a plan shows a seq scan on a child table inside a loop, or
-- execution time past ~50 ms.

begin;
set local role anon;

-- getModels(): the summary list every public page loads (the select list is SUMMARY_COLUMNS in
-- src/services/mappers.ts).
explain (analyze, buffers, costs off)
select slug, name, year, scale, is_racing, car_number, livery_hex, team, event, series, condition, location, added_at,
       brand_slug, brand_name, brand_logo_path, manufacturer_slug, manufacturer_name, manufacturer_logo_path,
       category_slug, category_name, category_sort_order, driver_slug, driver_name, driver_country_code,
       color_slugs, color_names, image_storage_path, image_external_url, thumb_storage_path, thumb_external_url,
       image_width, image_height, image_count
from diecast.model_summaries
where is_published = true
order by name;

-- getModelBySlug(): the model with its singular relations …
explain (analyze, buffers, costs off)
select m.*, b.name, mf.name, c.name, d.name
from diecast.models m
join diecast.brands b on b.id = m.brand_id
join diecast.manufacturers mf on mf.id = m.manufacturer_id
join diecast.categories c on c.id = m.category_id
left join diecast.drivers d on d.id = m.driver_id
where m.slug = 'porsche-911-gt3-rs-2003-altaya-white';

-- … and, in parallel, its children filtered through the slug (`model:models!inner()`).
explain (analyze, buffers, costs off)
select mc.position, col.*
from diecast.model_colors mc
join diecast.colors col on col.id = mc.color_id
join diecast.models m on m.id = mc.model_id
where m.slug = 'porsche-911-gt3-rs-2003-altaya-white';

explain (analyze, buffers, costs off)
select i.*
from diecast.model_images i
join diecast.models m on m.id = i.model_id
where m.slug = 'porsche-911-gt3-rs-2003-altaya-white';

rollback;
