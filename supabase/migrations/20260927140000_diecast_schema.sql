-- Phase 6 · 1/3 — diecast schema: tables, constraints, indexes, triggers.
-- Design: docs/SCHEMA.md. Everything lives in schema `diecast`, never `public`.
-- Row access is decided by RLS (next migration); grants here are schema/table-level only.

create schema if not exists diecast;

grant usage on schema diecast to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function diecast.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Used by the models.livery_hex CHECK (a CHECK can't contain a subquery directly).
create or replace function diecast.is_hex_palette(p text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
    select coalesce(array_length(p, 1), 0) <= 8
       and not exists (select 1 from unnest(p) as h where h !~ '^#[0-9A-F]{6}$')
$$;

-- ---------------------------------------------------------------------------
-- Lookups
-- ---------------------------------------------------------------------------

create table diecast.brands (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name        text not null check (char_length(btrim(name)) between 1 and 80),
    logo_path   text check (char_length(logo_path) <= 300),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create unique index brands_name_lower_key on diecast.brands (lower(name));

create table diecast.manufacturers (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name        text not null check (char_length(btrim(name)) between 1 and 80),
    logo_path   text check (char_length(logo_path) <= 300),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create unique index manufacturers_name_lower_key on diecast.manufacturers (lower(name));

create table diecast.categories (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name        text not null check (char_length(btrim(name)) between 1 and 40),
    sort_order  smallint not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create unique index categories_name_lower_key on diecast.categories (lower(name));

create table diecast.colors (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name        text not null check (char_length(btrim(name)) between 1 and 40),
    hex         text check (hex ~ '^#[0-9A-F]{6}$'), -- NULL = multi-color (conic swatch)
    sort_order  smallint not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create unique index colors_name_lower_key on diecast.colors (lower(name));

create table diecast.drivers (
    id            uuid primary key default gen_random_uuid(),
    slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name          text not null check (char_length(btrim(name)) between 1 and 80),
    country_code  char(2) check (country_code ~ '^[A-Z]{2}$'),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create unique index drivers_name_lower_key on diecast.drivers (lower(name));

create table diecast.tags (
    id          uuid primary key default gen_random_uuid(),
    slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name        text not null check (char_length(btrim(name)) between 1 and 40),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create unique index tags_name_lower_key on diecast.tags (lower(name));

-- ---------------------------------------------------------------------------
-- Models
-- ---------------------------------------------------------------------------

create table diecast.models (
    id               uuid primary key default gen_random_uuid(),
    slug             text not null unique
                     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
    name             text not null check (char_length(btrim(name)) between 1 and 120),
    year             smallint not null check (year between 1885 and 2100),
    brand_id         uuid not null references diecast.brands on delete restrict,
    manufacturer_id  uuid not null references diecast.manufacturers on delete restrict,
    category_id      uuid not null references diecast.categories on delete restrict,
    scale            text not null default '1:43' check (scale ~ '^1:[0-9]{1,3}$'),
    livery_hex       text[] not null default '{}' check (diecast.is_hex_palette(livery_hex)),
    is_racing        boolean not null default false,
    car_number       text check (car_number ~ '^[0-9A-Z]{1,4}$'),
    driver_id        uuid references diecast.drivers on delete restrict,
    team             text check (char_length(team) <= 120),
    event            text check (char_length(event) <= 120),
    series           text check (char_length(series) <= 120),
    description      text check (char_length(description) <= 10000),
    key_features     text[] not null default '{}' check (coalesce(array_length(key_features, 1), 0) <= 12),
    condition        text check (condition in ('mint', 'near_mint', 'excellent', 'good', 'fair', 'poor')),
    location         text check (char_length(location) <= 80),
    added_at         date,
    is_published     boolean not null default true,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index models_brand_id_idx        on diecast.models (brand_id);
create index models_manufacturer_id_idx on diecast.models (manufacturer_id);
create index models_category_id_idx     on diecast.models (category_id);
create index models_driver_id_idx       on diecast.models (driver_id);
create index models_added_at_idx        on diecast.models (added_at desc nulls last, slug);

create table diecast.model_colors (
    model_id  uuid not null references diecast.models on delete cascade,
    color_id  uuid not null references diecast.colors on delete restrict,
    position  smallint not null check (position >= 0),
    primary key (model_id, color_id),
    unique (model_id, position)
);
create index model_colors_color_id_idx on diecast.model_colors (color_id);

create table diecast.model_tags (
    model_id  uuid not null references diecast.models on delete cascade,
    tag_id    uuid not null references diecast.tags on delete restrict,
    primary key (model_id, tag_id)
);
create index model_tags_tag_id_idx on diecast.model_tags (tag_id);

create table diecast.model_images (
    id                  uuid primary key default gen_random_uuid(),
    model_id            uuid not null references diecast.models on delete cascade,
    position            smallint not null check (position >= 0),
    is_primary          boolean not null default false,
    storage_path        text check (char_length(storage_path) <= 300),
    thumb_storage_path  text check (char_length(thumb_storage_path) <= 300),
    external_url        text check (external_url ~ '^https://' and char_length(external_url) <= 500),
    thumb_external_url  text check (thumb_external_url ~ '^https://' and char_length(thumb_external_url) <= 500),
    alt                 text check (char_length(alt) <= 200),
    width               integer check (width > 0),
    height              integer check (height > 0),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (model_id, position),
    check (storage_path is not null or external_url is not null)
);
create unique index model_images_one_primary on diecast.model_images (model_id) where is_primary;

-- Admin-only. Separate table because RLS is row-level: private text can't share a public row.
create table diecast.model_private_notes (
    model_id    uuid primary key references diecast.models on delete cascade,
    notes       text not null check (char_length(notes) <= 10000),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Owner allow-list behind diecast.is_admin(). Rows are inserted manually (SQL editor).
create table diecast.admin_users (
    user_id     uuid primary key references auth.users on delete cascade,
    created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
    t text;
begin
    foreach t in array array[
        'brands', 'manufacturers', 'categories', 'colors', 'drivers', 'tags',
        'models', 'model_images', 'model_private_notes'
    ]
    loop
        execute format(
            'create trigger set_updated_at before update on diecast.%I
             for each row execute function diecast.set_updated_at()', t);
    end loop;
end;
$$;
