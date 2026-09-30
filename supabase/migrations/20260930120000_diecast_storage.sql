-- Phase 21 — Supabase Storage for model images.
--
-- 1. Bucket `model-images`: PUBLIC read (objects are served from
--    /storage/v1/object/public/model-images/<path> without RLS), admin-only writes.
--    Path scheme: models/{slug}/{position}-{full|thumb}.webp (see scripts/migrate-images/).
-- 2. diecast.set_image_storage(): flips model_images rows to their Storage paths (or back) in ONE
--    transaction, used by scripts/migrate-images/flip.ts (service role only).
--
-- Re-runnable: the bucket is upserted, policies are dropped and recreated.

-- ---- 1. bucket ---------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('model-images', 'model-images', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- Writes: admins only (diecast.is_admin(), same gate as the tables). The migration script uses the
-- service role, which bypasses these; the Phase 27 upload form will run as the signed-in admin.
-- SELECT is admin-only too: public URLs don't need it, and without it anon can't LIST the bucket.
-- Uploading with upsert needs SELECT + INSERT + UPDATE.
drop policy if exists "model-images: admin select" on storage.objects;
drop policy if exists "model-images: admin insert" on storage.objects;
drop policy if exists "model-images: admin update" on storage.objects;
drop policy if exists "model-images: admin delete" on storage.objects;

create policy "model-images: admin select" on storage.objects
    for select to authenticated
    using (bucket_id = 'model-images' and (select diecast.is_admin()));

create policy "model-images: admin insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'model-images' and (select diecast.is_admin()));

create policy "model-images: admin update" on storage.objects
    for update to authenticated
    using (bucket_id = 'model-images' and (select diecast.is_admin()))
    with check (bucket_id = 'model-images' and (select diecast.is_admin()));

create policy "model-images: admin delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'model-images' and (select diecast.is_admin()));

-- ---- 2. flip function --------------------------------------------------------------------------
-- p_rows: [{id, storage_path, thumb_storage_path, width, height}]. Null paths = roll back to
-- external_url (which is never cleared — it's the rollback path). width/height are only written
-- when given. Every id must exist, or nothing is changed. A dry run reports the exact counts and
-- rolls back.
create or replace function diecast.set_image_storage(
    p_rows    jsonb,
    p_dry_run boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_result  jsonb;
    v_updated integer;
    v_missing text[];
begin
    begin -- inner block: a dry run raises at its end, which rolls back everything done inside it
        select coalesce(array_agg(x.id::text), '{}') into v_missing
        from jsonb_to_recordset(p_rows) as x(id uuid)
        where not exists (select 1 from diecast.model_images i where i.id = x.id);
        if cardinality(v_missing) > 0 then
            raise exception 'set_image_storage: % unknown model_images id(s): %',
                cardinality(v_missing), array_to_string(v_missing[1:5], ', ');
        end if;

        with src as (
            select * from jsonb_to_recordset(p_rows)
                as x(id uuid, storage_path text, thumb_storage_path text, width integer, height integer)
        ), upd as (
            update diecast.model_images i
            set storage_path = s.storage_path,
                thumb_storage_path = s.thumb_storage_path,
                width = coalesce(s.width, i.width),
                height = coalesce(s.height, i.height)
            from src s
            where i.id = s.id
              and (i.storage_path, i.thumb_storage_path, i.width, i.height)
                  is distinct from (s.storage_path, s.thumb_storage_path, coalesce(s.width, i.width), coalesce(s.height, i.height))
            returning i.id
        )
        select count(*) into v_updated from upd;

        v_result := jsonb_build_object(
            'rows', jsonb_array_length(p_rows),
            'updated', v_updated,
            'on_storage', (select count(*) from diecast.model_images where storage_path is not null),
            'external_only', (select count(*) from diecast.model_images where storage_path is null),
            'total', (select count(*) from diecast.model_images));

        if p_dry_run then
            raise exception using errcode = 'ZZ001', message = 'diecast set_image_storage dry-run rollback';
        end if;
    exception
        when sqlstate 'ZZ001' then
            return v_result || jsonb_build_object('dry_run', true);
    end;

    return v_result || jsonb_build_object('dry_run', false);
end;
$$;

revoke all on function diecast.set_image_storage(jsonb, boolean) from public, anon, authenticated;
grant execute on function diecast.set_image_storage(jsonb, boolean) to service_role;
