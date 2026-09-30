-- Phase 25 — the admin model form's single write path.
--
-- diecast.save_model(p_model, p_original_slug, p_dry_run) creates (p_original_slug is null) or
-- updates one model and its colors in ONE transaction, so a failed save never leaves a model
-- without colors or half-edited. It runs with the CALLER's rights (security invoker): RLS stays the
-- gate — only diecast.is_admin() can write — and the explicit check below just turns a refusal
-- into a clear message instead of a confusing "not found".
--
-- It owns only the form's core fields (Phase 25). Description, key features, tags, private notes and
-- images are never touched here (Phases 26–27), so saving an imported model can't clear them.
-- The slug is set once, on create, and is stable afterwards: on update the payload's slug is ignored.
-- An update whose values all equal the stored ones changes nothing (not even updated_at), and a
-- dry run executes everything, reports what it would have done, then rolls itself back
-- (scripts/verify-model-form.ts uses that to prove the round-trip on every model without writing).
--
-- Errors meant for the user carry SQLSTATE class ZK (ZK409 conflict, ZK422 invalid, ZK404 gone):
-- src/lib/errors.ts shows their message as-is.
--
-- Payload (jsonb, snake_case):
--   slug, name, year, category_slug, scale, livery_hex[], color_slugs[] (1–3, ordered), is_racing,
--   car_number, team, event, series, condition, location, added_at ('YYYY-MM-DD'), is_published,
--   brand / manufacturer: {slug} or {slug, name, create: true}
--   driver: null, {slug} or {slug, name, create: true}

-- ---- lookup resolution (brands / manufacturers / drivers) ----------------------------------------
create or replace function diecast.resolve_model_lookup(p_table text, p_ref jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_id    uuid;
    v_slug  text := p_ref ->> 'slug';
    v_name  text := btrim(p_ref ->> 'name');
    v_label text;
begin
    v_label := case p_table
        when 'brands' then 'brand'
        when 'manufacturers' then 'manufacturer'
        when 'drivers' then 'driver'
    end;
    if v_label is null then
        raise exception 'resolve_model_lookup: table % is not a model lookup', p_table;
    end if;
    if v_slug is null then
        raise exception using errcode = 'ZK422', message = format('Choose a %s.', v_label);
    end if;

    execute format('select id from diecast.%I where slug = $1', p_table) into v_id using v_slug;

    if v_id is null and coalesce((p_ref ->> 'create')::boolean, false) then
        if v_name is null or v_name = '' then
            raise exception using errcode = 'ZK422', message = format('The new %s needs a name.', v_label);
        end if;
        -- Names are unique case-insensitively: reuse an existing row rather than fail on a near-duplicate.
        execute format('select id from diecast.%I where lower(name) = lower($1)', p_table) into v_id using v_name;
        if v_id is null then
            execute format('insert into diecast.%I (slug, name) values ($1, $2) returning id', p_table)
                into v_id using v_slug, v_name;
        end if;
    end if;

    if v_id is null then
        raise exception using errcode = 'ZK422', message = format('Unknown %s "%s".', v_label, v_slug);
    end if;
    return v_id;
end;
$$;

-- ---- save ----------------------------------------------------------------------------------------
create or replace function diecast.save_model(
    p_model          jsonb,
    p_original_slug  text    default null,
    p_dry_run        boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_id              uuid;
    v_slug            text;
    v_created         boolean := false;
    v_changed         boolean := false;
    v_rows            integer;

    v_name            text     := btrim(p_model ->> 'name');
    v_year            smallint;
    v_brand_id        uuid;
    v_manufacturer_id uuid;
    v_category_id     uuid;
    v_scale           text     := coalesce(nullif(btrim(p_model ->> 'scale'), ''), '1:43');
    v_livery_hex      text[];
    v_is_racing       boolean  := coalesce((p_model ->> 'is_racing')::boolean, false);
    v_car_number      text     := nullif(upper(btrim(p_model ->> 'car_number')), '');
    v_driver_id       uuid;
    v_team            text     := nullif(btrim(p_model ->> 'team'), '');
    v_event           text     := nullif(btrim(p_model ->> 'event'), '');
    v_series          text     := nullif(btrim(p_model ->> 'series'), '');
    v_condition       text     := nullif(btrim(p_model ->> 'condition'), '');
    v_location        text     := nullif(btrim(p_model ->> 'location'), '');
    v_added_at        date     := nullif(btrim(p_model ->> 'added_at'), '')::date;
    v_is_published    boolean  := coalesce((p_model ->> 'is_published')::boolean, true);

    v_color_slugs     text[];
    v_color_ids       uuid[];
    v_current_colors  uuid[];
begin
    if not (select diecast.is_admin()) then
        raise exception using errcode = '42501', message = 'Only the collection owner can save models.';
    end if;

    begin -- inner block: a dry run raises at its end, which rolls back everything done inside it

        -- ---- which model ------------------------------------------------------------------
        if p_original_slug is null then
            v_slug := btrim(p_model ->> 'slug');
            if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) > 80 then
                raise exception using errcode = 'ZK422',
                    message = 'The model address must be 1–80 lowercase letters, digits and single hyphens.';
            end if;
            if exists (select 1 from diecast.models where slug = v_slug) then
                raise exception using errcode = 'ZK409',
                    message = format('A model with the address "%s" already exists.', v_slug);
            end if;
        else
            select id, slug into v_id, v_slug from diecast.models where slug = p_original_slug for update;
            if v_id is null then
                raise exception using errcode = 'ZK404',
                    message = 'This model no longer exists — it may have been deleted in another tab.';
            end if;
        end if;

        -- ---- values -----------------------------------------------------------------------
        if v_name is null or v_name = '' then
            raise exception using errcode = 'ZK422', message = 'Enter the model name.';
        end if;
        if (p_model ->> 'year') is null or (p_model ->> 'year') !~ '^[0-9]{4}$' then
            raise exception using errcode = 'ZK422', message = 'Enter a four-digit year.';
        end if;
        v_year := (p_model ->> 'year')::smallint;

        v_brand_id        := diecast.resolve_model_lookup('brands', p_model -> 'brand');
        v_manufacturer_id := diecast.resolve_model_lookup('manufacturers', p_model -> 'manufacturer');
        if jsonb_typeof(p_model -> 'driver') = 'object' then
            v_driver_id := diecast.resolve_model_lookup('drivers', p_model -> 'driver');
        end if;

        select id into v_category_id from diecast.categories where slug = p_model ->> 'category_slug';
        if v_category_id is null then
            raise exception using errcode = 'ZK422', message = 'Choose a category.';
        end if;

        v_livery_hex := array(
            select upper(h) from jsonb_array_elements_text(coalesce(p_model -> 'livery_hex', '[]'::jsonb)) as h);

        v_color_slugs := array(
            select c from jsonb_array_elements_text(coalesce(p_model -> 'color_slugs', '[]'::jsonb)) as c);
        if cardinality(v_color_slugs) not between 1 and 3 then
            raise exception using errcode = 'ZK422', message = 'Choose one to three colors.';
        end if;
        if (select count(distinct c) from unnest(v_color_slugs) as c) <> cardinality(v_color_slugs) then
            raise exception using errcode = 'ZK422', message = 'A color is listed twice.';
        end if;
        v_color_ids := array(
            select col.id
            from unnest(v_color_slugs) with ordinality as u(slug, ord)
            join diecast.colors col on col.slug = u.slug
            order by u.ord);
        if cardinality(v_color_ids) <> cardinality(v_color_slugs) then
            raise exception using errcode = 'ZK422', message = 'Unknown color.';
        end if;

        -- ---- write the model row (table CHECKs validate lengths/formats) ------------------
        if v_id is null then
            insert into diecast.models (
                slug, name, year, brand_id, manufacturer_id, category_id, scale, livery_hex,
                is_racing, car_number, driver_id, team, event, series, condition, location,
                added_at, is_published)
            values (
                v_slug, v_name, v_year, v_brand_id, v_manufacturer_id, v_category_id, v_scale, v_livery_hex,
                v_is_racing, v_car_number, v_driver_id, v_team, v_event, v_series, v_condition, v_location,
                v_added_at, v_is_published)
            returning id into v_id;
            v_created := true;
            v_changed := true;
        else
            update diecast.models as m set
                name = v_name, year = v_year, brand_id = v_brand_id, manufacturer_id = v_manufacturer_id,
                category_id = v_category_id, scale = v_scale, livery_hex = v_livery_hex,
                is_racing = v_is_racing, car_number = v_car_number, driver_id = v_driver_id,
                team = v_team, event = v_event, series = v_series, condition = v_condition,
                location = v_location, added_at = v_added_at, is_published = v_is_published
            where m.id = v_id
              and (m.name, m.year, m.brand_id, m.manufacturer_id, m.category_id, m.scale, m.livery_hex,
                   m.is_racing, m.car_number, m.driver_id, m.team, m.event, m.series, m.condition,
                   m.location, m.added_at, m.is_published)
                  is distinct from
                  (v_name, v_year, v_brand_id, v_manufacturer_id, v_category_id, v_scale, v_livery_hex,
                   v_is_racing, v_car_number, v_driver_id, v_team, v_event, v_series, v_condition,
                   v_location, v_added_at, v_is_published);
            get diagnostics v_rows = row_count;
            v_changed := v_rows > 0;
        end if;

        -- ---- colors: replace only when the ordered set differs ----------------------------
        v_current_colors := array(
            select color_id from diecast.model_colors where model_id = v_id order by position);
        if v_current_colors is distinct from v_color_ids then
            delete from diecast.model_colors where model_id = v_id;
            insert into diecast.model_colors (model_id, color_id, position)
            select v_id, u.id, (u.ord - 1)::smallint
            from unnest(v_color_ids) with ordinality as u(id, ord);
            if not v_changed then
                update diecast.models set updated_at = now() where id = v_id; -- colors are part of the model
            end if;
            v_changed := true;
        end if;

        if p_dry_run then
            raise exception using errcode = 'ZZ001', message = 'diecast save_model dry-run rollback';
        end if;
    exception
        when sqlstate 'ZZ001' then
            return jsonb_build_object('slug', v_slug, 'created', v_created, 'changed', v_changed, 'dry_run', true);
    end;

    return jsonb_build_object('slug', v_slug, 'created', v_created, 'changed', v_changed, 'dry_run', false);
end;
$$;

-- Signed-in users only (RLS + the is_admin() check above decide the rest); anon gets nothing.
-- Default privileges grant execute to anon on new functions, so revoke explicitly.
revoke all on function diecast.resolve_model_lookup(text, jsonb) from public, anon;
revoke all on function diecast.save_model(jsonb, text, boolean) from public, anon;
grant execute on function diecast.resolve_model_lookup(text, jsonb) to authenticated, service_role;
grant execute on function diecast.save_model(jsonb, text, boolean) to authenticated, service_role;
