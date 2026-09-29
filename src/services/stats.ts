// Derived from the already-loaded ModelSummary[] list — no separate DB round trip. The ROADMAP
// read strategy caches one summary list client-side specifically so counts like these are free;
// Phase 23 adds richer stats (decades, racing vs road, color distribution) the same way.
import type {CollectionStats, ModelSummary} from "./types.ts";

export function getCollectionStats(models: ModelSummary[]): CollectionStats {
    return {
        totalModels: models.length,
        totalBrands: new Set(models.map((m) => m.brand.slug)).size,
        totalManufacturers: new Set(models.map((m) => m.manufacturer.slug)).size,
        totalCategories: new Set(models.map((m) => m.category.slug)).size,
    };
}
