// Pure client-side query logic over an already-loaded ModelSummary[] list — no network calls.
// This is what makes the ROADMAP read strategy work: load the summary list once (getModels()),
// then filter/search/sort/facet-count entirely in memory. Built to be extended (not replaced) by
// Phase 15 (full search ranking + more sort options) and Phase 14 (the filter panel UI).
import type {ModelSummary} from "./types.ts";

export type CollectionFilters = {
    brands: string[];
    manufacturers: string[];
    categories: string[];
    colors: string[];
};

export const EMPTY_FILTERS: CollectionFilters = {brands: [], manufacturers: [], categories: [], colors: []};

// Multi-value: OR within a field (any selected brand matches), AND across fields.
export function matchesFilters(model: ModelSummary, filters: CollectionFilters): boolean {
    const brandOk = filters.brands.length === 0 || filters.brands.includes(model.brand.slug);
    const manufacturerOk = filters.manufacturers.length === 0 || filters.manufacturers.includes(model.manufacturer.slug);
    const categoryOk = filters.categories.length === 0 || filters.categories.includes(model.category.slug);
    const colorOk = filters.colors.length === 0 || model.colors.some((c) => filters.colors.includes(c.slug));
    return brandOk && manufacturerOk && categoryOk && colorOk;
}

export function filterModels(models: ModelSummary[], filters: CollectionFilters): ModelSummary[] {
    return models.filter((m) => matchesFilters(m, filters));
}

// NFD-strip combining marks, then lowercase: "Citroën" → "citroen", "Škoda" → "skoda".
export function normalizeSearchText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
}

function searchableFields(m: ModelSummary): string[] {
    return [m.name, m.brand.name, m.manufacturer.name, String(m.year), m.category.name, m.driver?.name ?? "", m.carNumber ?? ""];
}

// Substring match across name/brand/manufacturer/year/category/driver/car number, diacritic- and
// case-insensitive. No ranking yet — Phase 15 adds name-prefix > name-contains > other-field.
export function searchModels(models: ModelSummary[], query: string): ModelSummary[] {
    const needle = normalizeSearchText(query.trim());
    if (!needle) return models;
    return models.filter((m) => searchableFields(m).some((field) => normalizeSearchText(field).includes(needle)));
}

export type SortOption = "name-asc" | "name-desc" | "year-desc" | "year-asc" | "added-desc" | "added-asc";

// NULL `added_at` always sorts last, in either direction (204+ models share one import-day date —
// Phase 15 documents this; here it just needs to never crash or float NULLs to the top).
function compareAddedAt(a: ModelSummary, b: ModelSummary, direction: 1 | -1): number {
    if (a.addedAt === b.addedAt) return 0;
    if (a.addedAt === null) return 1;
    if (b.addedAt === null) return -1;
    return direction * a.addedAt.localeCompare(b.addedAt);
}

// Ties always break by slug, so order never flickers across renders/refreshes.
const COMPARATORS: Record<SortOption, (a: ModelSummary, b: ModelSummary) => number> = {
    "name-asc": (a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
    "name-desc": (a, b) => b.name.localeCompare(a.name) || a.slug.localeCompare(b.slug),
    "year-desc": (a, b) => b.year - a.year || a.slug.localeCompare(b.slug),
    "year-asc": (a, b) => a.year - b.year || a.slug.localeCompare(b.slug),
    "added-desc": (a, b) => compareAddedAt(a, b, -1) || a.slug.localeCompare(b.slug),
    "added-asc": (a, b) => compareAddedAt(a, b, 1) || a.slug.localeCompare(b.slug),
};

export function sortModels(models: ModelSummary[], sort: SortOption): ModelSummary[] {
    return [...models].sort(COMPARATORS[sort]);
}

export type FacetCount = {slug: string; name: string; count: number};
export type FacetCounts = {
    brands: FacetCount[];
    manufacturers: FacetCount[];
    categories: FacetCount[];
    colors: FacetCount[];
};

function countBy(models: ModelSummary[], refsOf: (m: ModelSummary) => {slug: string; name: string}[]): FacetCount[] {
    const counts = new Map<string, FacetCount>();
    for (const model of models) {
        for (const ref of refsOf(model)) {
            const entry = counts.get(ref.slug) ?? {slug: ref.slug, name: ref.name, count: 0};
            entry.count += 1;
            counts.set(ref.slug, entry);
        }
    }
    return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Each facet's counts are computed against the *other* active filters (Phase 14 requirement), so
// selecting a brand narrows manufacturer/category/color counts, but the brand facet itself still
// reflects everyone else — otherwise a selected option's own count would just equal the total.
export function getFacetCounts(models: ModelSummary[], filters: CollectionFilters): FacetCounts {
    return {
        brands: countBy(filterModels(models, {...filters, brands: []}), (m) => [m.brand]),
        manufacturers: countBy(filterModels(models, {...filters, manufacturers: []}), (m) => [m.manufacturer]),
        categories: countBy(filterModels(models, {...filters, categories: []}), (m) => [m.category]),
        colors: countBy(filterModels(models, {...filters, colors: []}), (m) => m.colors),
    };
}
