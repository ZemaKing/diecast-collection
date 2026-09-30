// The diecast image job for the generic pipeline in scripts/images/ (ROADMAP Phase 21).
// Sources are the `model_images` rows' postimg URLs (`external_url`, the roadmap's `legacy_url`).
// Both variants are generated from the full-size original — the old postimg thumbnails aren't used.
import type {SupabaseClient} from "@supabase/supabase-js";

import type {ImageJob, ImageSource} from "../images/types.ts";
import {MODEL_IMAGES_BUCKET} from "../../src/services/image-url.ts";

export type ImageRow = {
    id: string;
    position: number;
    storage_path: string | null;
    thumb_storage_path: string | null;
    external_url: string | null;
    thumb_external_url: string | null;
    width: number | null;
    height: number | null;
    models: {slug: string};
};

export async function loadImageRows(supabase: SupabaseClient): Promise<ImageRow[]> {
    const {data, error, count} = await supabase
        .schema("diecast")
        .from("model_images")
        .select("id, position, storage_path, thumb_storage_path, external_url, thumb_external_url, width, height, models!inner(slug)", {count: "exact"})
        .order("model_id")
        .order("position")
        .range(0, 9999);
    if (error) throw new Error(`Reading diecast.model_images failed: ${error.message}`);
    const rows = data as unknown as ImageRow[];
    if (count !== rows.length) throw new Error(`Read ${rows.length} of ${count} model_images rows.`);
    return rows.sort((a, b) => a.models.slug.localeCompare(b.models.slug) || a.position - b.position);
}

export const sourceKey = (row: Pick<ImageRow, "position" | "models">) => `${row.models.slug}/${row.position}`;

export function rowToSource(row: ImageRow): ImageSource | null {
    if (!row.external_url) return null; // uploaded straight to Storage (Phase 27) — nothing to migrate
    return {key: sourceKey(row), url: row.external_url, vars: {slug: row.models.slug, position: row.position}};
}

const job: ImageJob = {
    name: "diecast model images",
    bucket: MODEL_IMAGES_BUCKET, // the bucket resolveImageUrl() builds public URLs for
    pathPattern: "models/{slug}/{position}-{variant}.{ext}",
    variants: [
        {name: "full", maxWidth: 1600, quality: 82},
        {name: "thumb", maxWidth: 400, quality: 75},
    ],
    manifest: new URL("./manifest.json", import.meta.url),
    cacheControl: "604800",
    concurrency: 4,
    retries: 4,
    async sources(supabase) {
        return (await loadImageRows(supabase)).map(rowToSource).filter((s): s is ImageSource => s !== null);
    },
};

export default job;
