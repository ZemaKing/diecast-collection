// Model reads. getModels() is the one call the collection page needs (ROADMAP read strategy:
// load the summary list once, cache it, filter/search/sort/facet client-side — see
// collection-query.ts). getModelBySlug() is for the details page (Phase 19).
import type {Tables} from "../lib/database.types.ts";
import {supabase} from "../lib/supabase.ts";

import {mapModel, mapModelSummary, SUMMARY_COLUMNS, type ModelColorRow, type ModelTagRow, type ModelWithRelations} from "./mappers.ts";
import {unwrap} from "./supabase-query.ts";
import type {Model, ModelSummary} from "./types.ts";

// Published models only — explicitly, not just via RLS. The view runs with the caller's rights, so
// for a signed-in admin RLS would also return unpublished drafts; every public page (collection,
// browse, statistics, the header count) must show exactly what a visitor sees, whoever is signed
// in (Phase 24). Drafts are the admin dashboard's business: getDraftModels().
export async function getModels(): Promise<ModelSummary[]> {
    const rows = await unwrap(supabase.from("model_summaries").select(SUMMARY_COLUMNS).eq("is_published", true).order("name"));
    return rows.map(mapModelSummary);
}

// Unpublished models — only ever non-empty for an admin (RLS hides drafts from everyone else).
export async function getDraftModels(): Promise<ModelSummary[]> {
    const rows = await unwrap(supabase.from("model_summaries").select(SUMMARY_COLUMNS).eq("is_published", false).order("updated_at", {ascending: false}));
    return rows.map(mapModelSummary);
}

export async function getRecentlyAddedModels(limit = 8): Promise<ModelSummary[]> {
    const rows = await unwrap(
        supabase
            .from("model_summaries")
            .select(SUMMARY_COLUMNS)
            .eq("is_published", true)
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
// All four run at once (Phase 33 — it used to be the model, then the rest by its id: two round
// trips): each child query joins `models` (named explicitly, so unambiguous) only to filter by
// slug — `model:models!inner()` selects nothing from it. RLS applies to that join too, so a model
// the caller can't see yields no children, and the model query's not_found is what's thrown.
export async function getModelBySlug(slug: string): Promise<Model> {
    const [row, colorRows, imageRows, tagRows] = await Promise.all([
        unwrap(
            supabase
                .from("models")
                .select("*, brand:brands(*), manufacturer:manufacturers(*), category:categories(*), driver:drivers(*)")
                .eq("slug", slug)
                .single(),
        ) as unknown as Promise<ModelWithRelations>,
        unwrap(supabase.from("model_colors").select("position, color:colors(*), model:models!inner()").eq("model.slug", slug)) as unknown as Promise<ModelColorRow[]>,
        unwrap(supabase.from("model_images").select("*, model:models!inner()").eq("model.slug", slug)) as unknown as Promise<Tables<"model_images">[]>,
        unwrap(supabase.from("model_tags").select("tag:tags(*), model:models!inner()").eq("model.slug", slug)) as unknown as Promise<ModelTagRow[]>,
    ]);

    return mapModel(row, colorRows, imageRows, tagRows);
}
