-- Phase 28 — Supporting data management.
--
-- 1. Bucket `lookup-logos`: brand / manufacturer logos uploaded from the admin UI. PUBLIC read,
--    admin-only writes (same rules as `model-images`). Path scheme: {brands|manufacturers}/{slug}-{key}.{svg|webp},
--    a fresh random key per upload (objects are cached — never overwrite a path). `logo_path` then holds
--    that key; the 64 logos shipped in public/ keep their '/brands/…' paths (docs/SCHEMA.md §7).
-- 2. diecast.merge_drivers(): moves every model of one driver to another and deletes the first, in
--    ONE transaction (the alias-cleanup case, docs/SCHEMA.md D5).
--
-- Renaming and deleting lookups needs nothing new: the Phase 6 "admin can write" policies already
-- allow it, and every FK from models / model_colors / model_tags is ON DELETE RESTRICT, so a lookup
-- still in use can't be deleted.
--
-- Re-runnable: the bucket is upserted, policies are dropped and recreated.

-- ---- 1. bucket ---------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lookup-logos', 'lookup-logos', true, 262144, array['image/svg+xml', 'image/webp', 'image/png'])
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lookup-logos: admin select" on storage.objects;
drop policy if exists "lookup-logos: admin insert" on storage.objects;
drop policy if exists "lookup-logos: admin update" on storage.objects;
drop policy if exists "lookup-logos: admin delete" on storage.objects;

-- SELECT is admin-only: public URLs don't need it, and without it anon can't LIST the bucket.
create policy "lookup-logos: admin select" on storage.objects
    for select to authenticated
    using (bucket_id = 'lookup-logos' and (select diecast.is_admin()));

create policy "lookup-logos: admin insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'lookup-logos' and (select diecast.is_admin()));

create policy "lookup-logos: admin update" on storage.objects
    for update to authenticated
    using (bucket_id = 'lookup-logos' and (select diecast.is_admin()))
    with check (bucket_id = 'lookup-logos' and (select diecast.is_admin()));

create policy "lookup-logos: admin delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'lookup-logos' and (select diecast.is_admin()));

-- ---- 2. driver merge ---------------------------------------------------------------------------
-- Every model of driver `p_from_slug` gets driver `p_into_slug`; then `p_from_slug` is deleted.
-- Security invoker: RLS ("admin can write" on models and drivers) is the gate; the explicit
-- is_admin() check only makes the refusal readable. Errors use class ZK like save_model().
create or replace function diecast.merge_drivers(
    p_from_slug text,
    p_into_slug text,
    p_dry_run   boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_from   diecast.drivers%rowtype;
    v_into   diecast.drivers%rowtype;
    v_moved  integer;
    v_result jsonb;
begin
    if not (select diecast.is_admin()) then
        raise exception using errcode = '42501', message = 'Only the collection owner can merge drivers.';
    end if;

    select * into v_from from diecast.drivers where slug = p_from_slug;
    select * into v_into from diecast.drivers where slug = p_into_slug;
    if v_from.id is null or v_into.id is null then
        raise exception using errcode = 'ZK404', message = 'That driver no longer exists — reload the list.';
    end if;
    if v_from.id = v_into.id then
        raise exception using errcode = 'ZK422', message = 'Choose a different driver to merge into.';
    end if;

    begin -- inner block: a dry run raises at its end, which rolls back everything done inside it
        update diecast.models set driver_id = v_into.id where driver_id = v_from.id;
        get diagnostics v_moved = row_count;

        -- The flag is the only other driver field: keep it if the target has none.
        if v_into.country_code is null and v_from.country_code is not null then
            update diecast.drivers set country_code = v_from.country_code where id = v_into.id;
        end if;

        delete from diecast.drivers where id = v_from.id;

        v_result := jsonb_build_object('from', v_from.name, 'into', v_into.name, 'moved', v_moved);

        if p_dry_run then
            raise exception using errcode = 'ZZ001', message = 'diecast merge_drivers dry-run rollback';
        end if;
    exception
        when sqlstate 'ZZ001' then
            return v_result || jsonb_build_object('dry_run', true);
    end;

    return v_result || jsonb_build_object('dry_run', false);
end;
$$;

revoke all on function diecast.merge_drivers(text, text, boolean) from public, anon;
grant execute on function diecast.merge_drivers(text, text, boolean) to authenticated, service_role;
