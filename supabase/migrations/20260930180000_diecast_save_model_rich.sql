-- Phase 26 — the model form's rich sections go through the same single write path.
--
-- Replaces diecast.save_model() (Phase 25, migration 20260930150000) with a version that also saves
-- the description, key features, tags and the admin-only private notes — still in ONE transaction
-- with the model row and its colors, still as the caller (security invoker: RLS is the gate).
--
-- The four new payload keys are OPTIONAL: a key that is absent leaves that field exactly as it is
-- (so a Phase 25-shaped payload behaves as before); a key that is present sets it, and an empty
-- value clears it.
--   description   text (markdown-lite, stored as typed — never HTML; '' → NULL)
--   key_features  text[] (trimmed, blanks dropped, ≤ 12 items of ≤ 200 characters, in order)
--   tags          [{slug} | {slug, name, create: true}] (the model's whole tag set; new tags created)
--   notes         text (model_private_notes; '' → the row is deleted)
-- `changed` in the result covers these too; a notes-only change doesn't bump models.updated_at
-- (that timestamp is public through model_summaries, the notes aren't).
--
-- resolve_model_lookup() now also resolves (and creates) tags.

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
        when 'tags' then 'tag'
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
    v_touch           boolean := false; -- colors/tags changed without the row changing
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
    v_description     text;
    v_key_features    text[]   := '{}';
    v_notes           text;

    v_color_slugs     text[];
    v_color_ids       uuid[];
    v_current_colors  uuid[];
    v_tag_ids         uuid[];
    v_current_tags    uuid[];
    v_current_notes   text;
    v_ref             jsonb;
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
            -- Current description/features double as "keep as is" for keys the payload leaves out.
            select id, slug, description, key_features
              into v_id, v_slug, v_description, v_key_features
              from diecast.models where slug = p_original_slug for update;
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

        -- Rich fields (Phase 26): only when the payload carries them.
        if p_model ? 'description' then
            v_description := nullif(btrim(p_model ->> 'description'), '');
        end if;
        if p_model ? 'key_features' then
            v_key_features := array(
                select btrim(f)
                from jsonb_array_elements_text(coalesce(p_model -> 'key_features', '[]'::jsonb)) with ordinality as x(f, ord)
                where btrim(f) <> ''
                order by ord);
            if cardinality(v_key_features) > 12 then
                raise exception using errcode = 'ZK422', message = 'Use at most 12 key features.';
            end if;
            if exists (select 1 from unnest(v_key_features) as f where char_length(f) > 200) then
                raise exception using errcode = 'ZK422', message = 'Keep each key feature under 200 characters.';
            end if;
        end if;

        -- ---- write the model row (table CHECKs validate lengths/formats) ------------------
        if v_id is null then
            insert into diecast.models (
                slug, name, year, brand_id, manufacturer_id, category_id, scale, livery_hex,
                is_racing, car_number, driver_id, team, event, series, condition, location,
                added_at, is_published, description, key_features)
            values (
                v_slug, v_name, v_year, v_brand_id, v_manufacturer_id, v_category_id, v_scale, v_livery_hex,
                v_is_racing, v_car_number, v_driver_id, v_team, v_event, v_series, v_condition, v_location,
                v_added_at, v_is_published, v_description, coalesce(v_key_features, '{}'))
            returning id into v_id;
            v_created := true;
            v_changed := true;
        else
            update diecast.models as m set
                name = v_name, year = v_year, brand_id = v_brand_id, manufacturer_id = v_manufacturer_id,
                category_id = v_category_id, scale = v_scale, livery_hex = v_livery_hex,
                is_racing = v_is_racing, car_number = v_car_number, driver_id = v_driver_id,
                team = v_team, event = v_event, series = v_series, condition = v_condition,
                location = v_location, added_at = v_added_at, is_published = v_is_published,
                description = v_description, key_features = v_key_features
            where m.id = v_id
              and (m.name, m.year, m.brand_id, m.manufacturer_id, m.category_id, m.scale, m.livery_hex,
                   m.is_racing, m.car_number, m.driver_id, m.team, m.event, m.series, m.condition,
                   m.location, m.added_at, m.is_published, m.description, m.key_features)
                  is distinct from
                  (v_name, v_year, v_brand_id, v_manufacturer_id, v_category_id, v_scale, v_livery_hex,
                   v_is_racing, v_car_number, v_driver_id, v_team, v_event, v_series, v_condition,
                   v_location, v_added_at, v_is_published, v_description, v_key_features);
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
            v_touch := true;
        end if;

        -- ---- tags: the whole set, replaced only when it differs (no order) ----------------
        if p_model ? 'tags' then
            v_tag_ids := '{}';
            for v_ref in select * from jsonb_array_elements(coalesce(p_model -> 'tags', '[]'::jsonb)) loop
                v_tag_ids := v_tag_ids || diecast.resolve_model_lookup('tags', v_ref);
            end loop;
            v_tag_ids := array(select distinct t from unnest(v_tag_ids) as t order by t);
            v_current_tags := array(select tag_id from diecast.model_tags where model_id = v_id order by tag_id);
            if v_current_tags is distinct from v_tag_ids then
                delete from diecast.model_tags where model_id = v_id;
                insert into diecast.model_tags (model_id, tag_id) select v_id, t from unnest(v_tag_ids) as t;
                v_touch := true;
            end if;
        end if;

        if v_touch then
            if not v_changed then
                update diecast.models set updated_at = now() where id = v_id; -- colors/tags are part of the model
            end if;
            v_changed := true;
        end if;

        -- ---- private notes (admin-only table; one row per model, none when empty) ---------
        if p_model ? 'notes' then
            v_notes := nullif(btrim(p_model ->> 'notes'), '');
            select notes into v_current_notes from diecast.model_private_notes where model_id = v_id;
            if v_current_notes is distinct from v_notes then
                if v_notes is null then
                    delete from diecast.model_private_notes where model_id = v_id;
                else
                    insert into diecast.model_private_notes (model_id, notes) values (v_id, v_notes)
                    on conflict (model_id) do update set notes = excluded.notes;
                end if;
                v_changed := true;
            end if;
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

-- `create or replace` keeps the existing grants; restated so this file stands on its own.
revoke all on function diecast.resolve_model_lookup(text, jsonb) from public, anon;
revoke all on function diecast.save_model(jsonb, text, boolean) from public, anon;
grant execute on function diecast.resolve_model_lookup(text, jsonb) to authenticated, service_role;
grant execute on function diecast.save_model(jsonb, text, boolean) to authenticated, service_role;
