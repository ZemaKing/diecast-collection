-- Phase 7 — transactional importer used by scripts/import/run.ts (service role only).
--
-- diecast.import_collection(payload, dry_run, fail_after) applies the whole desired state in ONE
-- transaction: any error rolls back every table. Upserts are keyed by slug and only touch rows whose
-- values actually differ, so a second run reports 0 inserted / 0 updated. A dry run executes the real
-- statements, captures the exact counts, then rolls itself back. `fail_after` injects an error after a
-- given step (used once to prove that a mid-run failure leaves nothing behind).
--
-- Import owns only the columns derived from car-models.json. It never deletes models, never touches
-- owner-edited fields (description, condition, location, is_published, …), and leaves images at
-- positions other than 0 alone.

create or replace function diecast.import_collection(
    p_payload    jsonb,
    p_dry_run    boolean default true,
    p_fail_after text    default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_result  jsonb := '{}'::jsonb;
    v_ins     integer;
    v_upd     integer;
    v_del     integer;
    v_missing text[];
begin
    begin -- inner block: a dry run raises at its end, which rolls back everything done inside it

        -- ---- brands -------------------------------------------------------------------------
        with src as (
            select * from jsonb_to_recordset(p_payload -> 'brands') as x(slug text, name text, logo_path text)
        ), up as (
            insert into diecast.brands as t (slug, name, logo_path)
            select slug, name, logo_path from src
            on conflict (slug) do update
                set name = excluded.name, logo_path = excluded.logo_path
                where (t.name, t.logo_path) is distinct from (excluded.name, excluded.logo_path)
            returning (t.xmax::text = '0') as inserted
        )
        select count(*) filter (where inserted), count(*) filter (where not inserted) into v_ins, v_upd from up;
        v_result := v_result || jsonb_build_object('brands', jsonb_build_object('inserted', v_ins, 'updated', v_upd));
        if p_fail_after = 'brands' then raise exception 'injected failure after brands'; end if;

        -- ---- manufacturers ------------------------------------------------------------------
        with src as (
            select * from jsonb_to_recordset(p_payload -> 'manufacturers') as x(slug text, name text, logo_path text)
        ), up as (
            insert into diecast.manufacturers as t (slug, name, logo_path)
            select slug, name, logo_path from src
            on conflict (slug) do update
                set name = excluded.name, logo_path = excluded.logo_path
                where (t.name, t.logo_path) is distinct from (excluded.name, excluded.logo_path)
            returning (t.xmax::text = '0') as inserted
        )
        select count(*) filter (where inserted), count(*) filter (where not inserted) into v_ins, v_upd from up;
        v_result := v_result || jsonb_build_object('manufacturers', jsonb_build_object('inserted', v_ins, 'updated', v_upd));
        if p_fail_after = 'manufacturers' then raise exception 'injected failure after manufacturers'; end if;

        -- ---- colors -------------------------------------------------------------------------
        with src as (
            select * from jsonb_to_recordset(p_payload -> 'colors') as x(slug text, name text, hex text, sort_order smallint)
        ), up as (
            insert into diecast.colors as t (slug, name, hex, sort_order)
            select slug, name, hex, sort_order from src
            on conflict (slug) do update
                set name = excluded.name, hex = excluded.hex, sort_order = excluded.sort_order
                where (t.name, t.hex, t.sort_order) is distinct from (excluded.name, excluded.hex, excluded.sort_order)
            returning (t.xmax::text = '0') as inserted
        )
        select count(*) filter (where inserted), count(*) filter (where not inserted) into v_ins, v_upd from up;
        v_result := v_result || jsonb_build_object('colors', jsonb_build_object('inserted', v_ins, 'updated', v_upd));

        -- ---- drivers (country_code is owner data: never overwritten) --------------------------
        with src as (
            select * from jsonb_to_recordset(p_payload -> 'drivers') as x(slug text, name text)
        ), up as (
            insert into diecast.drivers as t (slug, name)
            select slug, name from src
            on conflict (slug) do update
                set name = excluded.name
                where t.name is distinct from excluded.name
            returning (t.xmax::text = '0') as inserted
        )
        select count(*) filter (where inserted), count(*) filter (where not inserted) into v_ins, v_upd from up;
        v_result := v_result || jsonb_build_object('drivers', jsonb_build_object('inserted', v_ins, 'updated', v_upd));

        -- ---- referential pre-checks (fail loudly instead of silently dropping models) --------
        select array_agg(distinct x ->> 'category_slug') into v_missing
        from jsonb_array_elements(p_payload -> 'models') as x
        where not exists (select 1 from diecast.categories c where c.slug = x ->> 'category_slug');
        if v_missing is not null then
            raise exception 'unknown category slug(s): %', v_missing;
        end if;

        select array_agg(x ->> 'slug') into v_missing
        from jsonb_array_elements(p_payload -> 'models') as x
        where not exists (select 1 from diecast.brands b where b.slug = x ->> 'brand_slug')
           or not exists (select 1 from diecast.manufacturers m where m.slug = x ->> 'manufacturer_slug')
           or (x ->> 'driver_slug' is not null
               and not exists (select 1 from diecast.drivers d where d.slug = x ->> 'driver_slug'));
        if v_missing is not null then
            raise exception 'models reference missing brand/manufacturer/driver: %', v_missing;
        end if;

        -- ---- models ---------------------------------------------------------------------------
        with src as (
            select * from jsonb_to_recordset(p_payload -> 'models') as x(
                slug text, name text, year smallint, brand_slug text, manufacturer_slug text,
                category_slug text, scale text, livery_hex text[], is_racing boolean,
                car_number text, driver_slug text, added_at date)
        ), resolved as (
            select s.slug, s.name, s.year, b.id as brand_id, mf.id as manufacturer_id, c.id as category_id,
                   s.scale, s.livery_hex, s.is_racing, s.car_number, d.id as driver_id, s.added_at
            from src s
            join diecast.brands b         on b.slug = s.brand_slug
            join diecast.manufacturers mf on mf.slug = s.manufacturer_slug
            join diecast.categories c     on c.slug = s.category_slug
            left join diecast.drivers d   on d.slug = s.driver_slug
        ), up as (
            insert into diecast.models as t (
                slug, name, year, brand_id, manufacturer_id, category_id,
                scale, livery_hex, is_racing, car_number, driver_id, added_at)
            select slug, name, year, brand_id, manufacturer_id, category_id,
                   scale, livery_hex, is_racing, car_number, driver_id, added_at
            from resolved
            on conflict (slug) do update set
                name = excluded.name, year = excluded.year, brand_id = excluded.brand_id,
                manufacturer_id = excluded.manufacturer_id, category_id = excluded.category_id,
                scale = excluded.scale, livery_hex = excluded.livery_hex, is_racing = excluded.is_racing,
                car_number = excluded.car_number, driver_id = excluded.driver_id, added_at = excluded.added_at
            where (t.name, t.year, t.brand_id, t.manufacturer_id, t.category_id, t.scale, t.livery_hex,
                   t.is_racing, t.car_number, t.driver_id, t.added_at)
                  is distinct from
                  (excluded.name, excluded.year, excluded.brand_id, excluded.manufacturer_id, excluded.category_id,
                   excluded.scale, excluded.livery_hex, excluded.is_racing, excluded.car_number,
                   excluded.driver_id, excluded.added_at)
            returning (t.xmax::text = '0') as inserted
        )
        select count(*) filter (where inserted), count(*) filter (where not inserted) into v_ins, v_upd from up;
        v_result := v_result || jsonb_build_object('models', jsonb_build_object('inserted', v_ins, 'updated', v_upd));
        if p_fail_after = 'models' then raise exception 'injected failure after models'; end if;

        -- ---- model_colors: make each imported model's set exactly match the payload -----------
        with src as (
            select m.id as model_id, c.id as color_id, x.position
            from jsonb_to_recordset(p_payload -> 'model_colors') as x(model_slug text, color_slug text, position smallint)
            join diecast.models m on m.slug = x.model_slug
            join diecast.colors c on c.slug = x.color_slug
        ), gone as (
            delete from diecast.model_colors mc
            where mc.model_id in (
                select m.id from diecast.models m
                where m.slug in (select x ->> 'slug' from jsonb_array_elements(p_payload -> 'models') as x))
              and not exists (
                select 1 from src
                where src.model_id = mc.model_id and src.color_id = mc.color_id and src.position = mc.position)
            returning 1
        )
        select count(*) into v_del from gone;

        with src as (
            select m.id as model_id, c.id as color_id, x.position
            from jsonb_to_recordset(p_payload -> 'model_colors') as x(model_slug text, color_slug text, position smallint)
            join diecast.models m on m.slug = x.model_slug
            join diecast.colors c on c.slug = x.color_slug
        ), added as (
            insert into diecast.model_colors (model_id, color_id, position)
            select model_id, color_id, position from src
            on conflict (model_id, color_id) do nothing
            returning 1
        )
        select count(*) into v_ins from added;
        v_result := v_result || jsonb_build_object('model_colors', jsonb_build_object('inserted', v_ins, 'deleted', v_del));

        -- ---- model_images (position 0 = the legacy primary image) ------------------------------
        with src as (
            select m.id as model_id, x.position, x.is_primary, x.external_url, x.thumb_external_url
            from jsonb_to_recordset(p_payload -> 'model_images') as x(
                model_slug text, position smallint, is_primary boolean, external_url text, thumb_external_url text)
            join diecast.models m on m.slug = x.model_slug
        ), up as (
            insert into diecast.model_images as t (model_id, position, is_primary, external_url, thumb_external_url)
            select model_id, position, is_primary, external_url, thumb_external_url from src
            on conflict (model_id, position) do update set
                is_primary = excluded.is_primary,
                external_url = excluded.external_url,
                thumb_external_url = excluded.thumb_external_url
            where (t.is_primary, t.external_url, t.thumb_external_url)
                  is distinct from (excluded.is_primary, excluded.external_url, excluded.thumb_external_url)
            returning (t.xmax::text = '0') as inserted
        )
        select count(*) filter (where inserted), count(*) filter (where not inserted) into v_ins, v_upd from up;
        v_result := v_result || jsonb_build_object('model_images', jsonb_build_object('inserted', v_ins, 'updated', v_upd));

        -- ---- totals after this run + models the payload doesn't know about --------------------
        v_result := v_result || jsonb_build_object('totals', jsonb_build_object(
            'models',        (select count(*) from diecast.models),
            'brands',        (select count(*) from diecast.brands),
            'manufacturers', (select count(*) from diecast.manufacturers),
            'categories',    (select count(*) from diecast.categories),
            'colors',        (select count(*) from diecast.colors),
            'drivers',       (select count(*) from diecast.drivers),
            'model_colors',  (select count(*) from diecast.model_colors),
            'model_images',  (select count(*) from diecast.model_images)
        ));
        v_result := v_result || jsonb_build_object('models_not_in_payload', (
            select coalesce(jsonb_agg(m.slug order by m.slug), '[]'::jsonb) from diecast.models m
            where m.slug not in (select x ->> 'slug' from jsonb_array_elements(p_payload -> 'models') as x)));

        if p_dry_run then
            raise exception using errcode = 'ZZ001', message = 'diecast import dry-run rollback';
        end if;
    exception
        when sqlstate 'ZZ001' then
            return v_result || jsonb_build_object('dry_run', true);
    end;

    return v_result || jsonb_build_object('dry_run', false);
end;
$$;

-- Only the service role (local import script) may run it. Default privileges would otherwise let
-- anon/authenticated execute it (they'd still be stopped by grants/RLS, but don't offer it at all).
revoke all on function diecast.import_collection(jsonb, boolean, text) from public, anon, authenticated;
grant execute on function diecast.import_collection(jsonb, boolean, text) to service_role;
