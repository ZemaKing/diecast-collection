// Pure logic behind supporting-data management (ROADMAP Phase 28): the quick-create dialogs in the
// model form and the /admin/data list page. Labels, validation mirroring the lookup tables' CHECKs
// (docs/SCHEMA.md §4.2–4.7), logo file rules and Storage keys, usage counts, list filtering.
import {normalizeSearchText} from "../services/collection-query.ts";
import {SLUG_PATTERN, slugify} from "./slug.ts";

export type LookupKind = "brands" | "manufacturers" | "drivers" | "tags" | "colors" | "categories";

// Tab order on the list page.
export const LOOKUP_KINDS: LookupKind[] = ["brands", "manufacturers", "drivers", "tags", "colors", "categories"];

export const LOOKUP_LABELS: Record<LookupKind, {one: string; many: string; title: string}> = {
    brands: {one: "brand", many: "brands", title: "Brands"},
    manufacturers: {one: "manufacturer", many: "manufacturers", title: "Manufacturers"},
    drivers: {one: "driver", many: "drivers", title: "Drivers"},
    tags: {one: "tag", many: "tags", title: "Tags"},
    colors: {one: "color", many: "colors", title: "Colors"},
    categories: {one: "category", many: "categories", title: "Categories"},
};

// `char_length(btrim(name)) between 1 and N` on each table.
export const LOOKUP_NAME_MAX: Record<LookupKind, number> = {
    brands: 80, manufacturers: 80, drivers: 80, tags: 40, colors: 40, categories: 40,
};

// Categories can only be renamed: each one's color is a `--cat-<slug>` design token, so adding one
// is a code change (CLAUDE.md), and the five seeded ones are all in use.
export function canCreateLookup(kind: LookupKind): boolean {
    return kind !== "categories";
}

export function hasLogo(kind: LookupKind): kind is "brands" | "manufacturers" {
    return kind === "brands" || kind === "manufacturers";
}

// One row of any lookup table, as the list page and the dialogs use it. Kind-specific fields are
// null where they don't apply. `count` = models using it (drafts included — the admin sees them).
export type LookupRow = {
    id: string;
    slug: string;
    name: string;
    logoPath: string | null;
    countryCode: string | null;
    hex: string | null;
    sortOrder: number;
    count: number;
};

// What the dialog edits. `hex` is "" for a multi-color (no single swatch, like "Multi").
export type LookupDraft = {
    name: string;
    countryCode: string;
    hex: string;
    multiColor: boolean;
};

export type LookupDraftErrors = Partial<Record<"name" | "countryCode" | "hex", string>>;

export function lookupToDraft(row: LookupRow | null, name = ""): LookupDraft {
    return {
        name: row?.name ?? name,
        countryCode: row?.countryCode ?? "",
        hex: row?.hex ?? (row ? "" : DEFAULT_COLOR_HEX),
        multiColor: row ? row.hex === null : false,
    };
}

// A new color's starting swatch (data, not UI styling): neutral mid-gray, like a new livery slice.
export const DEFAULT_COLOR_HEX = "#808080";

const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const HEX_PATTERN = /^#[0-9A-F]{6}$/;

export function normalizeCountryCode(value: string): string {
    return value.trim().toUpperCase();
}

// The address a new row gets — derived from the name and fixed afterwards (filter links and browse
// pages use it, so renaming never breaks a shared link).
export function lookupSlugFor(name: string): string {
    return slugify(name.trim());
}

// `existing` = every row of that table; `editing` = the row being edited (null = create).
export function validateLookupDraft(
    kind: LookupKind,
    draft: LookupDraft,
    existing: Pick<LookupRow, "slug" | "name">[],
    editing: Pick<LookupRow, "slug"> | null,
): LookupDraftErrors {
    const errors: LookupDraftErrors = {};
    const {one} = LOOKUP_LABELS[kind];
    const name = draft.name.trim();
    const others = existing.filter((r) => r.slug !== editing?.slug);

    if (!name) errors.name = `Give the ${one} a name.`;
    else if (name.length > LOOKUP_NAME_MAX[kind]) errors.name = `Keep the name to ${LOOKUP_NAME_MAX[kind]} characters.`;
    else if (others.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())) {
        errors.name = `There's already a ${one} called “${name}”.`;
    } else if (!editing) {
        const slug = lookupSlugFor(name);
        if (!SLUG_PATTERN.test(slug)) errors.name = "The name needs at least one letter or digit (A–Z, 0–9).";
        else if (others.some((r) => r.slug === slug)) {
            errors.name = `“${name}” would get the address “${slug}”, which another ${one} already uses — pick a more distinct name.`;
        }
    }

    if (kind === "drivers") {
        const code = normalizeCountryCode(draft.countryCode);
        if (code && !COUNTRY_PATTERN.test(code)) errors.countryCode = "Use the two-letter country code, e.g. FI, FR or GB.";
    }
    if (kind === "colors" && !draft.multiColor && !HEX_PATTERN.test(draft.hex.trim().toUpperCase())) {
        errors.hex = "Pick a swatch color.";
    }
    return errors;
}

// The table columns a draft writes (kind-specific ones only for their kind).
export type LookupWrite = {name: string; country_code?: string | null; hex?: string | null};

export function draftToWrite(kind: LookupKind, draft: LookupDraft): LookupWrite {
    const write: LookupWrite = {name: draft.name.trim()};
    if (kind === "drivers") write.country_code = normalizeCountryCode(draft.countryCode) || null;
    if (kind === "colors") write.hex = draft.multiColor ? null : draft.hex.trim().toUpperCase();
    return write;
}

// Did the draft change anything on the row? (Saving an untouched dialog is a no-op.)
export function isLookupDraftChanged(kind: LookupKind, row: LookupRow, draft: LookupDraft): boolean {
    const write = draftToWrite(kind, draft);
    return write.name !== row.name
        || (kind === "drivers" && (write.country_code ?? null) !== row.countryCode)
        || (kind === "colors" && (write.hex ?? null) !== row.hex);
}

// ---- logos ----------------------------------------------------------------------------------------

// The bucket's file_size_limit (migration 20261002090000). SVGs go up as they are; raster files are
// resized in the browser to LOGO_MAX_PX WebP first, so only the original's size is capped there.
export const MAX_LOGO_SVG_BYTES = 256 * 1024;
export const MAX_LOGO_RASTER_BYTES = 5 * 1024 * 1024;
export const LOGO_MAX_PX = 512;
export const LOGO_ACCEPT = ".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp";

export type LogoFileCheck = {ok: true; format: "svg" | "raster"} | {ok: false; reason: string};

export function checkLogoFile(file: {name: string; type: string; size: number}): LogoFileCheck {
    const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
    const type = file.type.toLowerCase();
    if (type === "image/svg+xml" || ext === "svg") {
        return file.size > MAX_LOGO_SVG_BYTES
            ? {ok: false, reason: `${file.name} is larger than 256 KB — simplify the SVG or use a PNG.`}
            : {ok: true, format: "svg"};
    }
    if (["image/png", "image/jpeg", "image/webp"].includes(type) || ["png", "jpg", "jpeg", "webp"].includes(ext)) {
        return file.size > MAX_LOGO_RASTER_BYTES
            ? {ok: false, reason: `${file.name} is larger than 5 MB.`}
            : {ok: true, format: "raster"};
    }
    return {ok: false, reason: `${file.name} isn't an SVG, PNG, JPG or WEBP file.`};
}

// `{brands|manufacturers}/{slug}-{key}.{ext}` in the lookup-logos bucket — a fresh key per upload,
// because objects are cached for a week and a path is never overwritten.
export function logoStorageKey(kind: "brands" | "manufacturers", slug: string, key: string, ext: "svg" | "webp" | "png"): string {
    return `${kind}/${slug}-${key}.${ext}`;
}

// A logo uploaded through the admin (a Storage key) — as opposed to one of the files shipped in
// public/ ("/brands/…"), which the app must never try to delete.
export function isUploadedLogo(path: string | null | undefined): path is string {
    const p = path?.trim();
    return !!p && !p.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(p);
}

// ---- usage & listing ------------------------------------------------------------------------------

// id → how many rows reference it.
export function countUsage(ids: (string | null | undefined)[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const id of ids) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
}

export function pluralModels(count: number): string {
    return count === 1 ? "1 model" : `${count} models`;
}

// Why a row can't be deleted (null = it can). The database refuses anyway (FK ON DELETE RESTRICT);
// this just says so before trying.
export function deleteBlockedReason(kind: LookupKind, row: Pick<LookupRow, "count">): string | null {
    if (kind === "categories") return "Categories can be renamed, not deleted.";
    if (row.count === 0) return null;
    const fix = kind === "drivers" ? " Merge it into another driver, or change those models first." : " Change those models first.";
    return `Used by ${pluralModels(row.count)}.${fix}`;
}

export type LookupSort = "name" | "count";

// Diacritic-insensitive name/address filter, then A–Z or most-used first.
export function filterLookupRows(rows: LookupRow[], query: string, sort: LookupSort = "name"): LookupRow[] {
    const needle = normalizeSearchText(query.trim());
    const matching = needle
        ? rows.filter((r) => normalizeSearchText(r.name).includes(needle) || r.slug.includes(needle))
        : rows;
    const byName = (a: LookupRow, b: LookupRow) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
    return [...matching].sort(sort === "count" ? (a, b) => b.count - a.count || byName(a, b) : byName);
}

// The collection filter that lists a row's models, where the collection has one.
export function lookupCollectionPath(kind: LookupKind, slug: string): string | null {
    const key = {brands: "brand", manufacturers: "manufacturer", colors: "color", categories: "category"}[kind as string];
    return key ? `/?${key}=${encodeURIComponent(slug)}` : null;
}

// ---- list page tab (?tab=) ------------------------------------------------------------------------

export function parseLookupTab(value: string | null): LookupKind {
    return LOOKUP_KINDS.includes(value as LookupKind) ? (value as LookupKind) : "brands";
}
