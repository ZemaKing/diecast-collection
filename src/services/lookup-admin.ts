// Supporting-data writes (ROADMAP Phase 28): create / rename / delete brands, manufacturers,
// drivers, tags, colors (and rename categories), logo uploads, and the driver merge. Plain table
// writes as the signed-in user — the Phase 6 "admin can write" policies are the gate, and every FK
// to a lookup is ON DELETE RESTRICT, so the database itself refuses to delete one still in use.
import {toAppError, type AppError} from "../lib/errors.ts";
import type {Json, TablesInsert} from "../lib/database.types.ts";
import {supabase} from "../lib/supabase.ts";
import {newImageKey} from "../utils/model-images.ts";
import {
    LOOKUP_LABELS,
    countUsage,
    hasLogo,
    isUploadedLogo,
    logoStorageKey,
    lookupSlugFor,
    type LookupKind,
    type LookupRow,
    type LookupWrite,
} from "../utils/lookup-admin.ts";

import {LOOKUP_LOGOS_BUCKET} from "./image-url.ts";
import {unwrap} from "./supabase-query.ts";

// Objects are cached for a week, which is why a new logo always gets a new file name.
const CACHE_CONTROL = "604800";

type AnyLookupRow = {
    id: string;
    slug: string;
    name: string;
    logo_path?: string | null;
    country_code?: string | null;
    hex?: string | null;
    sort_order?: number;
};

// One code path for six tables: the typed client can't take a union of table names, so the builder
// is typed as one of them and rows are read back through AnyLookupRow.
function lookupTable(kind: LookupKind) {
    return supabase.from(kind as "tags");
}

function toLookupRow(row: AnyLookupRow, count: number): LookupRow {
    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        logoPath: row.logo_path ?? null,
        countryCode: row.country_code ?? null,
        hex: row.hex ?? null,
        sortOrder: row.sort_order ?? 0,
        count,
    };
}

// The column on `models` that points at each lookup (colors and tags go through join tables).
const MODEL_COLUMN = {brands: "brand_id", manufacturers: "manufacturer_id", drivers: "driver_id", categories: "category_id"} as const;

// id → number of models using it. RLS lets the admin see drafts, so drafts count too (they block a
// delete just the same).
async function getUsage(kind: LookupKind): Promise<Map<string, number>> {
    if (kind === "colors") {
        const rows = await unwrap(supabase.from("model_colors").select("color_id"));
        return countUsage(rows.map((r) => r.color_id));
    }
    if (kind === "tags") {
        const rows = await unwrap(supabase.from("model_tags").select("tag_id"));
        return countUsage(rows.map((r) => r.tag_id));
    }
    const column = MODEL_COLUMN[kind];
    const rows = await unwrap(supabase.from("models").select(column));
    return countUsage(rows.map((r) => (r as Record<string, string | null>)[column]));
}

// Every row of one lookup table with its usage count, A–Z (the page re-sorts as asked).
export async function getLookupRows(kind: LookupKind): Promise<LookupRow[]> {
    const [rows, usage] = await Promise.all([
        unwrap(lookupTable(kind).select("*").order("name")),
        getUsage(kind),
    ]);
    return (rows as AnyLookupRow[]).map((r) => toLookupRow(r, usage.get(r.id) ?? 0));
}

// Constraint violations in words for this table.
function lookupError(kind: LookupKind, error: unknown): AppError {
    const appError = toAppError(error);
    const {one} = LOOKUP_LABELS[kind];
    if (appError.code === "23505") return {...appError, message: `There's already a ${one} with that name or address.`};
    if (appError.code === "23503") return {...appError, message: `This ${one} is still used by a model — change those models first.`};
    return appError;
}

export type LogoChange =
    | {action: "keep"}
    | {action: "remove"}
    | {action: "upload"; blob: Blob; ext: "svg" | "webp" | "png"; contentType: string};

export type SaveLookupResult = {
    row: Pick<LookupRow, "slug" | "name" | "logoPath" | "hex" | "countryCode">;
    // A replaced/removed uploaded logo that couldn't be deleted from Storage (the save stands).
    orphanedFiles: string[];
};

async function uploadLogo(path: string, change: Extract<LogoChange, {action: "upload"}>): Promise<void> {
    const {error} = await supabase.storage
        .from(LOOKUP_LOGOS_BUCKET)
        .upload(path, change.blob, {contentType: change.contentType, cacheControl: CACHE_CONTROL, upsert: false});
    if (!error) return;
    const appError = toAppError(error);
    if (/bucket not found/i.test(error.message)) {
        throw {...appError, kind: "config", retryable: false, message: "Logo storage isn't set up yet — migration 20261002090000 hasn't been applied."} satisfies AppError;
    }
    throw {...appError, message: `Couldn't upload the logo: ${appError.message}`} satisfies AppError;
}

// Best effort; returns the paths that couldn't be removed. Only uploaded logos (Storage keys) are
// ever passed here — the files shipped in public/ aren't the app's to delete.
export async function removeLogoFiles(paths: string[]): Promise<string[]> {
    const keys = paths.filter(isUploadedLogo);
    if (keys.length === 0) return [];
    try {
        const {error} = await supabase.storage.from(LOOKUP_LOGOS_BUCKET).remove(keys);
        return error ? keys : [];
    } catch {
        return keys;
    }
}

async function nextColorSortOrder(): Promise<number> {
    const rows = await unwrap(supabase.from("colors").select("sort_order").order("sort_order", {ascending: false}).limit(1));
    return (rows[0]?.sort_order ?? 0) + 1;
}

// Creates (`editing` null) or updates one row. A logo upload follows the Phase 27 photo order:
// upload under a fresh name → write the row (a refused write removes the new file again) → only
// then remove the replaced file. The address (slug) is derived from the name on create and never
// changes afterwards.
export async function saveLookup(
    kind: LookupKind,
    options: {editing: LookupRow | null; write: LookupWrite; logo?: LogoChange},
): Promise<SaveLookupResult> {
    const {editing, write, logo = {action: "keep"}} = options;
    const slug = editing?.slug ?? lookupSlugFor(write.name);
    const previousLogo = editing?.logoPath ?? null;

    let logoPath = previousLogo;
    let uploaded: string | null = null;
    if (hasLogo(kind) && logo.action === "upload") {
        uploaded = logoStorageKey(kind, slug, newImageKey(), logo.ext);
        await uploadLogo(uploaded, logo);
        logoPath = uploaded;
    } else if (hasLogo(kind) && logo.action === "remove") {
        logoPath = null;
    }

    const columns: Record<string, unknown> = {...write};
    if (hasLogo(kind)) columns.logo_path = logoPath;
    // A new color goes to the end of the color filter's list.
    if (!editing && kind === "colors") columns.sort_order = await nextColorSortOrder();

    let saved: AnyLookupRow;
    try {
        const query = editing
            ? lookupTable(kind).update(columns as TablesInsert<"tags">).eq("slug", editing.slug).select()
            : lookupTable(kind).insert({...columns, slug} as TablesInsert<"tags">).select();
        const rows = (await unwrap(query)) as AnyLookupRow[];
        // RLS doesn't error on a refused UPDATE — it just matches no rows.
        if (!rows[0]) throw toAppError({code: editing ? "42501" : "PGRST116", message: "write matched no rows"});
        saved = rows[0];
    } catch (error) {
        if (uploaded) await removeLogoFiles([uploaded]);
        throw lookupError(kind, error);
    }

    const replaced = previousLogo && previousLogo !== logoPath ? [previousLogo] : [];
    const row = toLookupRow(saved, editing?.count ?? 0);
    return {
        row: {slug: row.slug, name: row.name, logoPath: row.logoPath, hex: row.hex, countryCode: row.countryCode},
        orphanedFiles: await removeLogoFiles(replaced),
    };
}

// Deletes an unused row; the database refuses one still referenced (23503 → a clear message). An
// uploaded logo is removed afterwards, best effort.
export async function deleteLookup(kind: LookupKind, row: Pick<LookupRow, "slug" | "logoPath">): Promise<{orphanedFiles: string[]}> {
    let deleted: unknown[];
    try {
        deleted = await unwrap(lookupTable(kind).delete().eq("slug", row.slug).select("id"));
    } catch (error) {
        throw lookupError(kind, error);
    }
    if (deleted.length === 0) throw toAppError({code: "42501", message: "delete matched no rows"});
    return {orphanedFiles: hasLogo(kind) && row.logoPath ? await removeLogoFiles([row.logoPath]) : []};
}

export type MergeDriversResult = {from: string; into: string; moved: number; dryRun: boolean};

// Every model of `fromSlug` gets driver `intoSlug`, then `fromSlug` is deleted — one transaction
// (diecast.merge_drivers, migration 20261002090000).
export async function mergeDrivers(fromSlug: string, intoSlug: string, options: {dryRun?: boolean} = {}): Promise<MergeDriversResult> {
    const row = (await unwrap(
        supabase.rpc("merge_drivers", {p_from_slug: fromSlug, p_into_slug: intoSlug, p_dry_run: options.dryRun ?? false}),
    )) as unknown as {from: string; into: string; moved: number; dry_run: boolean} & Record<string, Json>;
    return {from: row.from, into: row.into, moved: row.moved, dryRun: row.dry_run};
}
