// Admin writes for the model form (ROADMAP Phase 25). Every save goes through ONE database function,
// `diecast.save_model()` (migration 20260930150000): the model row and its colors are written in a
// single transaction, as the signed-in user — RLS (`is_admin()`) is the gate, not this file.
import {toAppError} from "../lib/errors.ts";
import type {Json} from "../lib/database.types.ts";
import {supabase} from "../lib/supabase.ts";
import type {ImagePayloadItem} from "../utils/model-images.ts";

import {MODEL_IMAGES_BUCKET} from "./image-url.ts";
import {unwrap} from "./supabase-query.ts";

// An existing lookup row by slug, or — with `create` — a new one the save inserts first (the
// driver/brand/manufacturer pickers can add a name that isn't in the list yet).
export type LookupInput = {slug: string; name: string; create?: boolean};

// The form's fields, as save_model() expects them. The Phase 26 keys (description, key features,
// tags, private notes) and the Phase 27 `images` (the whole ordered photo list, first = main photo,
// new photos already uploaded) are optional: absent = leave as is, present = set (empty clears).
export type ModelSavePayload = {
    slug: string;
    name: string;
    year: number;
    brand: LookupInput;
    manufacturer: LookupInput;
    category_slug: string;
    scale: string;
    livery_hex: string[];
    color_slugs: string[];
    is_racing: boolean;
    car_number: string | null;
    driver: LookupInput | null;
    team: string | null;
    event: string | null;
    series: string | null;
    condition: string | null;
    location: string | null;
    added_at: string | null;
    is_published: boolean;
    description?: string | null;
    key_features?: string[];
    tags?: LookupInput[];
    notes?: string | null;
    images?: ImagePayloadItem[];
};

export type SaveModelResult = {
    slug: string;
    created: boolean;
    // false when every submitted value already matched the stored one (nothing was written).
    changed: boolean;
    // Storage paths of the photos this save removed from the model (their rows are gone). The
    // caller deletes the files — after the commit, never before.
    removedFiles: string[];
    dryRun: boolean;
};

type SaveModelRow = {slug: string; created: boolean; changed: boolean; removed_files?: string[] | null; dry_run: boolean};

// `originalSlug` null = create. The slug never changes after creation: on update the payload's
// slug is ignored by the database. `dryRun` runs the real statements and rolls them back.
export async function saveModel(
    payload: ModelSavePayload,
    options: {originalSlug?: string | null; dryRun?: boolean} = {},
): Promise<SaveModelResult> {
    const row = (await unwrap(
        supabase.rpc("save_model", {
            p_model: payload as unknown as Json,
            p_original_slug: options.originalSlug ?? undefined,
            p_dry_run: options.dryRun ?? false,
        }),
    )) as unknown as SaveModelRow;
    return {slug: row.slug, created: row.created, changed: row.changed, removedFiles: row.removed_files ?? [], dryRun: row.dry_run};
}

// The owner's private notes for a model (`model_private_notes`, admin-only through RLS — anyone else
// gets no row, which reads as no notes). Only the edit form asks for them.
export async function getPrivateNotes(modelId: string): Promise<string | null> {
    const rows = await unwrap(supabase.from("model_private_notes").select("notes").eq("model_id", modelId).limit(1));
    return rows[0]?.notes ?? null;
}

// The form's live "address already taken" check. The database re-checks on save (a race can't
// slip through); an admin sees drafts through RLS, so a draft's slug counts too.
export async function isSlugTaken(slug: string): Promise<boolean> {
    const rows = await unwrap(supabase.from("models").select("slug").eq("slug", slug).limit(1));
    return rows.length > 0;
}

export type DeleteModelResult = {
    // Storage objects of the model's photos that could not be removed (the rows are gone either
    // way). Empty when there were none or all were removed.
    orphanedFiles: string[];
};

// Deletes the model; its colors, tags, images rows and private notes go with it (ON DELETE
// CASCADE, one statement). Photos already moved to Storage (Phase 21) are removed afterwards —
// best effort: a failure there is reported, never undoes the delete.
export async function deleteModel(slug: string): Promise<DeleteModelResult> {
    const [model] = await unwrap(supabase.from("models").select("id").eq("slug", slug).limit(1));
    if (!model) throw toAppError({code: "PGRST116", message: "model not found"});
    const images = await unwrap(
        supabase.from("model_images").select("storage_path, thumb_storage_path").eq("model_id", model.id),
    );
    const files = images.flatMap((i) => [i.storage_path, i.thumb_storage_path]).filter((p): p is string => !!p);

    const deleted = await unwrap(supabase.from("models").delete().eq("id", model.id).select("id"));
    // RLS doesn't error on a refused DELETE — it just matches no rows.
    if (deleted.length === 0) throw toAppError({code: "42501", message: "delete matched no rows"});

    return {orphanedFiles: await removeStorageFiles(files)};
}

// Best-effort removal of photo files; returns the ones that couldn't be removed (empty = all gone).
// Used after the database has already let go of them, so a failure only leaves an orphaned file.
export async function removeStorageFiles(paths: string[]): Promise<string[]> {
    if (paths.length === 0) return [];
    try {
        // No error = done: a file that was already gone isn't an orphan.
        const {error} = await supabase.storage.from(MODEL_IMAGES_BUCKET).remove(paths);
        return error ? paths : [];
    } catch {
        return paths;
    }
}
