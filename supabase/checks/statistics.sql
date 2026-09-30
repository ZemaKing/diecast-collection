-- Statistics page cross-check (ROADMAP Phase 23). Read-only — paste into the dashboard's SQL
-- editor. Every number on /statistics should equal a row below. `npm run verify:stats` runs the
-- same counts (through the API, with the anon key) and compares them with the page's own code.
-- Only published models count: that's what visitors (and the page) see.

-- Totals
select
    count(*)                        as models,
    count(distinct brand_id)        as brands,
    count(distinct manufacturer_id) as manufacturers,
    count(distinct category_id)     as categories
from diecast.models
where is_published;

-- Models per brand (most first) — "Top brands"
select b.name, count(*) as models
from diecast.models m join diecast.brands b on b.id = m.brand_id
where m.is_published
group by b.name
order by models desc, b.name;

-- Models per manufacturer (most first) — "Top manufacturers"
select mf.name, count(*) as models
from diecast.models m join diecast.manufacturers mf on mf.id = m.manufacturer_id
where m.is_published
group by mf.name
order by models desc, mf.name;

-- Models per category (in the categories' sort order)
select c.name, count(*) as models
from diecast.models m join diecast.categories c on c.id = m.category_id
where m.is_published
group by c.name, c.sort_order
order by c.sort_order;

-- Models by decade
select (m.year / 10) * 10 || 's' as decade, count(*) as models
from diecast.models m
where m.is_published
group by m.year / 10
order by m.year / 10;

-- Racing vs road
select case when m.is_racing then 'racing' else 'road' end as kind, count(*) as models
from diecast.models m
where m.is_published
group by m.is_racing;

-- Colors — a model counts once per livery color (two-tone liveries count twice), like the
-- Color filter
select co.name, co.hex, count(*) as models
from diecast.model_colors mc
join diecast.models m on m.id = mc.model_id
join diecast.colors co on co.id = mc.color_id
where m.is_published
group by co.name, co.hex
order by models desc, co.name;
