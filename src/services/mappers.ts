// Row → domain conversions. The only place that reads database.types.ts Row shapes directly.
import type {Tables} from "../lib/database.types.ts";

import {resolveImageUrl} from "./image-url.ts";
import type {Category, Driver, LookupRef, Model, ModelColor, ModelImage, ModelSummary, Tag} from "./types.ts";

// The model_summaries columns list views read (Phase 33) — selected explicitly instead of "*", so
// the view's id, is_published and timestamps aren't downloaded 227 times. One string literal, so
// supabase-js types the selected rows from it (a column missing here fails to compile where the
// rows meet mapModelSummary()).
export const SUMMARY_COLUMNS = "slug,name,year,scale,is_racing,car_number,livery_hex,team,event,series,condition,location,added_at,brand_slug,brand_name,brand_logo_path,manufacturer_slug,manufacturer_name,manufacturer_logo_path,category_slug,category_name,category_sort_order,driver_slug,driver_name,driver_country_code,color_slugs,color_names,image_storage_path,image_external_url,thumb_storage_path,thumb_external_url,image_width,image_height,image_count";

type SummaryColumn =
    | "slug" | "name" | "year" | "scale" | "is_racing" | "car_number" | "livery_hex" | "team" | "event" | "series"
    | "condition" | "location" | "added_at" | "brand_slug" | "brand_name" | "brand_logo_path" | "manufacturer_slug"
    | "manufacturer_name" | "manufacturer_logo_path" | "category_slug" | "category_name" | "category_sort_order"
    | "driver_slug" | "driver_name" | "driver_country_code" | "color_slugs" | "color_names" | "image_storage_path"
    | "image_external_url" | "thumb_storage_path" | "thumb_external_url" | "image_width" | "image_height" | "image_count";

export type SummaryRow = Pick<Tables<"model_summaries">, SummaryColumn>;

export function mapModelSummary(row: SummaryRow): ModelSummary {
    if (!row.slug || !row.name || row.year == null || !row.scale) {
        throw new Error(`model_summaries row is missing a required field (slug ${row.slug ?? "?"})`);
    }
    const colorSlugs = row.color_slugs ?? [];
    const colorNames = row.color_names ?? [];
    const hasImage = !!(row.image_external_url || row.image_storage_path);

    return {
        slug: row.slug,
        name: row.name,
        year: row.year,
        scale: row.scale,
        isRacing: row.is_racing ?? false,
        carNumber: row.car_number,
        liveryHex: row.livery_hex ?? [],
        team: row.team,
        event: row.event,
        series: row.series,
        condition: row.condition,
        location: row.location,
        addedAt: row.added_at,
        brand: {slug: row.brand_slug ?? "", name: row.brand_name ?? "", logoPath: row.brand_logo_path},
        manufacturer: {slug: row.manufacturer_slug ?? "", name: row.manufacturer_name ?? "", logoPath: row.manufacturer_logo_path},
        category: {slug: row.category_slug ?? "", name: row.category_name ?? "", sortOrder: row.category_sort_order ?? 0},
        driver: row.driver_slug ? {slug: row.driver_slug, name: row.driver_name ?? "", countryCode: row.driver_country_code} : null,
        colors: colorSlugs.map((slug, i): ModelColor => ({slug, name: colorNames[i] ?? slug})),
        image: hasImage
            ? {
                  url: resolveImageUrl({storagePath: row.image_storage_path, externalUrl: row.image_external_url}),
                  thumbUrl: resolveImageUrl({storagePath: row.thumb_storage_path, externalUrl: row.thumb_external_url}),
                  width: row.image_width,
                  height: row.image_height,
              }
            : null,
        imageCount: row.image_count ?? 0,
    };
}

function mapLookup(row: {slug: string; name: string; logo_path: string | null}): LookupRef {
    return {slug: row.slug, name: row.name, logoPath: row.logo_path};
}

export function mapCategory(row: Tables<"categories">): Category {
    return {slug: row.slug, name: row.name, sortOrder: row.sort_order};
}

export function mapDriver(row: Tables<"drivers">): Driver {
    return {slug: row.slug, name: row.name, countryCode: row.country_code};
}

export function mapModelImage(row: Tables<"model_images">): ModelImage {
    return {
        id: row.id,
        position: row.position,
        isPrimary: row.is_primary,
        url: resolveImageUrl({storagePath: row.storage_path, externalUrl: row.external_url}),
        thumbUrl: resolveImageUrl({storagePath: row.thumb_storage_path, externalUrl: row.thumb_external_url}),
        width: row.width,
        height: row.height,
        alt: row.alt?.trim() || null,
    };
}

export type ModelWithRelations = Tables<"models"> & {
    brand: Tables<"brands"> | null;
    manufacturer: Tables<"manufacturers"> | null;
    category: Tables<"categories"> | null;
    driver: Tables<"drivers"> | null;
};

export type ModelColorRow = {position: number; color: Tables<"colors"> | null};

export type ModelTagRow = {tag: Tables<"tags"> | null};

// Combines a `models` row (with its singular relations embedded) plus separately-fetched colors,
// images and tags — see getModelBySlug() in models.ts for why those are fetched apart.
export function mapModel(
    row: ModelWithRelations,
    colorRows: ModelColorRow[],
    imageRows: Tables<"model_images">[],
    tagRows: ModelTagRow[] = [],
): Model {
    if (!row.brand || !row.manufacturer || !row.category) {
        throw new Error(`model "${row.slug}" is missing a required relation (brand/manufacturer/category)`);
    }
    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        year: row.year,
        scale: row.scale,
        isRacing: row.is_racing,
        carNumber: row.car_number,
        liveryHex: row.livery_hex,
        team: row.team,
        event: row.event,
        series: row.series,
        condition: row.condition,
        location: row.location,
        addedAt: row.added_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        description: row.description,
        keyFeatures: row.key_features,
        // No position column on model_tags — alphabetical is the only stable order.
        tags: tagRows
            .flatMap((t): Tag[] => (t.tag ? [{slug: t.tag.slug, name: t.tag.name}] : []))
            .sort((a, b) => a.name.localeCompare(b.name)),
        isPublished: row.is_published,
        brand: mapLookup(row.brand),
        manufacturer: mapLookup(row.manufacturer),
        category: mapCategory(row.category),
        driver: row.driver ? mapDriver(row.driver) : null,
        colors: colorRows
            .filter((c): c is {position: number; color: Tables<"colors">} => !!c.color)
            .sort((a, b) => a.position - b.position)
            .map((c) => ({slug: c.color.slug, name: c.color.name})),
        images: [...imageRows].sort((a, b) => a.position - b.position).map(mapModelImage),
    };
}
