// Model reads. getModels() is the one call the collection page needs (ROADMAP read strategy:
// load the summary list once, cache it, filter/search/sort/facet client-side — see
// collection-query.ts). getModelBySlug() is for the details page (Phase 19).
import {supabase} from "../lib/supabase.ts";

import {mapModel, mapModelSummary, type ModelColorRow, type ModelTagRow, type ModelWithRelations} from "./mappers.ts";
import {unwrap} from "./supabase-query.ts";
import type {Model, ModelSummary} from "./types.ts";

export async function getModels(): Promise<ModelSummary[]> {
    const rows = await unwrap(supabase.from("model_summaries").select("*").order("name"));
    return rows.map(mapModelSummary);
}

export async function getRecentlyAddedModels(limit = 8): Promise<ModelSummary[]> {
    const rows = await unwrap(
        supabase
            .from("model_summaries")
            .select("*")
            .order("added_at", {ascending: false, nullsFirst: false})
            .order("name")
            .limit(limit),
    );
    return rows.map(mapModelSummary);
}

// Four queries instead of one deep embed: `model_colors`/`model_images`/`model_tags` all carry an
// FK to `models` AND to the `model_summaries` view (same FK name on both, since the view exposes
// the same id), which makes PostgREST's embed resolution ambiguous from `models`. Fetching them
// separately (each unambiguous on its own) sidesteps that instead of fighting embed hints.
export async function getModelBySlug(slug: string): Promise<Model> {
    const row = (await unwrap(
        supabase
            .from("models")
            .select("*, brand:brands(*), manufacturer:manufacturers(*), category:categories(*), driver:drivers(*)")
            .eq("slug", slug)
            .single(),
    )) as unknown as ModelWithRelations;

    const [colorRows, imageRows, tagRows] = await Promise.all([
        unwrap(supabase.from("model_colors").select("position, color:colors(*)").eq("model_id", row.id)) as Promise<ModelColorRow[]>,
        unwrap(supabase.from("model_images").select("*").eq("model_id", row.id)),
        unwrap(supabase.from("model_tags").select("tag:tags(*)").eq("model_id", row.id)) as Promise<ModelTagRow[]>,
    ]);

    return mapModel(row, colorRows, imageRows, tagRows);
}
