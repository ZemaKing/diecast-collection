-- Phase 6 · 2/3 — access control.
--   anon + authenticated non-admin: read published models, their children, and all lookups.
--   admin (diecast.is_admin()): full CRUD everywhere.
--   model_private_notes, admin_users: admin only.
-- Table grants are the outer gate, RLS the inner one. RLS is enabled on EVERY table.

create or replace function diecast.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from diecast.admin_users where user_id = (select auth.uid())
    )
$$;

revoke all on function diecast.is_admin() from public;
grant execute on function diecast.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grants (least privilege: anon can only ever read)
-- ---------------------------------------------------------------------------

grant select on all tables in schema diecast to anon;
grant select, insert, update, delete on all tables in schema diecast to authenticated;
grant all on all tables in schema diecast to service_role;

alter default privileges in schema diecast grant select on tables to anon;
alter default privileges in schema diecast grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema diecast grant all on tables to service_role;
alter default privileges in schema diecast grant execute on functions to anon, authenticated, service_role;

-- Defense in depth: anon can't even attempt to read the private tables (RLS would return 0 rows anyway).
revoke all on diecast.model_private_notes, diecast.admin_users from anon;
-- Nobody writes the allow-list through the API; it's managed in the SQL editor.
revoke insert, update, delete on diecast.admin_users from authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (no policy = no access)
-- ---------------------------------------------------------------------------

alter table diecast.brands              enable row level security;
alter table diecast.manufacturers       enable row level security;
alter table diecast.categories          enable row level security;
alter table diecast.colors              enable row level security;
alter table diecast.drivers             enable row level security;
alter table diecast.tags                enable row level security;
alter table diecast.models              enable row level security;
alter table diecast.model_colors        enable row level security;
alter table diecast.model_tags          enable row level security;
alter table diecast.model_images        enable row level security;
alter table diecast.model_private_notes enable row level security;
alter table diecast.admin_users         enable row level security;

-- `(select diecast.is_admin())` is evaluated once per statement (initplan), not per row.

-- Lookups: public read, admin write.
do $$
declare
    t text;
begin
    foreach t in array array['brands', 'manufacturers', 'categories', 'colors', 'drivers', 'tags']
    loop
        execute format(
            'create policy "public can read" on diecast.%I
             for select to anon, authenticated using (true)', t);
        execute format(
            'create policy "admin can write" on diecast.%I
             for all to authenticated
             using ((select diecast.is_admin())) with check ((select diecast.is_admin()))', t);
    end loop;
end;
$$;

-- Models: public sees published only; admin sees drafts too and can write.
create policy "public can read published" on diecast.models
    for select to anon, authenticated
    using (is_published or (select diecast.is_admin()));

create policy "admin can write" on diecast.models
    for all to authenticated
    using ((select diecast.is_admin())) with check ((select diecast.is_admin()));

-- Children of models: visible exactly when the parent model is visible to the caller
-- (the subquery on diecast.models is itself filtered by the policy above).
do $$
declare
    t text;
begin
    foreach t in array array['model_colors', 'model_tags', 'model_images']
    loop
        execute format(
            'create policy "public can read children of visible models" on diecast.%I
             for select to anon, authenticated
             using (exists (select 1 from diecast.models m where m.id = %I.model_id))', t, t);
        execute format(
            'create policy "admin can write" on diecast.%I
             for all to authenticated
             using ((select diecast.is_admin())) with check ((select diecast.is_admin()))', t);
    end loop;
end;
$$;

-- Private notes: admin only, no public policy at all.
create policy "admin only" on diecast.model_private_notes
    for all to authenticated
    using ((select diecast.is_admin())) with check ((select diecast.is_admin()));

-- Admin allow-list: admins may read it; nobody writes through the API
-- (rows are managed with the SQL editor / service role, which bypasses RLS).
create policy "admin can read" on diecast.admin_users
    for select to authenticated
    using ((select diecast.is_admin()));
