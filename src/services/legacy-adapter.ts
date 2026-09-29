// Bridges the Supabase-backed ModelSummary domain type to the pre-redesign DiecastModel shape,
// so ModelCard/DetailsModal keep working unmodified (ROADMAP Phase 10: "map domain model ->
// existing card/modal props, keep old UI intact"). Filtering itself runs on ModelSummary directly
// (collection-query.ts, Phase 13) — this only maps the already-filtered result for rendering.
// Goes away once ModelCard/DetailsModal are rebuilt against ModelSummary directly (Phase 16+).
import type {DiecastModel} from "../types.ts";

import type {ModelSummary} from "./types.ts";

export function toLegacyModel(model: ModelSummary): DiecastModel {
    return {
        id: model.slug,
        name: model.name,
        year: model.year,
        brand: model.brand.name,
        manufacturer: model.manufacturer.name,
        category: model.category.name as DiecastModel["category"],
        carNumber: model.carNumber ?? undefined,
        carDriver: model.driver?.name,
        driverCountry: model.driver?.countryCode ?? undefined,
        color: model.colors.map((c) => c.name),
        hex: model.liveryHex,
        thumbnail: model.image?.thumbUrl ?? model.image?.url ?? "",
        imageUrl: model.image?.url ?? model.image?.thumbUrl ?? "",
        scale: model.scale,
    };
}
