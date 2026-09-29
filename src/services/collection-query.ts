// Pure client-side query logic over an already-loaded ModelSummary[] list — no network calls.
// This is what makes the ROADMAP read strategy work: load the summary list once (getModels()),
// then filter/search/sort/facet-count entirely in memory.
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

function otherSearchFields(m: ModelSummary): string[] {
    return [m.brand.name, m.manufacturer.name, String(m.year), m.category.name, m.driver?.name ?? "", m.carNumber ?? ""];
}

// Relevance tier: 0 = name starts with the query, 1 = name contains it elsewhere, 2 = it only
// matched another field (brand/manufacturer/year/category/driver/car number), null = no match.
// Shared by searchModels() (keeps rank !== null) and sortModels()'s "relevance" option (orders by
// rank) so the two never define "match" and "order" differently.
function matchRank(m: ModelSummary, needle: string): number | null {
    if (!needle) return 0;
    const name = normalizeSearchText(m.name);
    if (name.startsWith(needle)) return 0;
    if (name.includes(needle)) return 1;
    if (otherSearchFields(m).some((field) => normalizeSearchText(field).includes(needle))) return 2;
    return null;
}

// Substring match across name/brand/manufacturer/year/category/driver/car number, diacritic- and
// case-insensitive. A pure filter — ordering by relevance is sortModels(..., "relevance")'s job,
// so search and sort compose the same way any other filter+sort pair does.
export function searchModels(models: ModelSummary[], query: string): ModelSummary[] {
    const needle = normalizeSearchText(query.trim());
    if (!needle) return models;
    return models.filter((m) => matchRank(m, needle) !== null);
}

export type SortOption =
    | "relevance"
    | "added-desc"
    | "added-asc"
    | "name-asc"
    | "name-desc"
    | "year-desc"
    | "year-asc"
    | "manufacturer"
    | "brand";

// NULL `added_at` always sorts last, in either direction (204+ models share one import-day date —
// Phase 15 documents this; here it just needs to never crash or float NULLs to the top).
function compareAddedAt(a: ModelSummary, b: ModelSummary, direction: 1 | -1): number {
    if (a.addedAt === b.addedAt) return 0;
    if (a.addedAt === null) return 1;
    if (b.addedAt === null) return -1;
    return direction * a.addedAt.localeCompare(b.addedAt);
}

// Ties always break by name then slug, so order never flickers across renders/refreshes — real
// data has 204+ models sharing one `added_at` (the Phase 7 import's backfill cutoff) and 160+
// sharing NULL, so "added-*" leans on this tie-break constantly, not just in edge cases.
const COMPARATORS: Record<Exclude<SortOption, "relevance">, (a: ModelSummary, b: ModelSummary) => number> = {
    "name-asc": (a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
    "name-desc": (a, b) => b.name.localeCompare(a.name) || a.slug.localeCompare(b.slug),
    "year-desc": (a, b) => b.year - a.year || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
    "year-asc": (a, b) => a.year - b.year || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
    "added-desc": (a, b) => compareAddedAt(a, b, -1) || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
    "added-asc": (a, b) => compareAddedAt(a, b, 1) || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
    "manufacturer": (a, b) => a.manufacturer.name.localeCompare(b.manufacturer.name) || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
    "brand": (a, b) => a.brand.name.localeCompare(b.brand.name) || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
};

// "relevance" needs the search query itself (it orders by matchRank(), the same tiers
// searchModels() filters on), so it's handled separately instead of living in the static
// COMPARATORS table above. Meaningless without a query — falls back to name-asc-ish stability.
export function sortModels(models: ModelSummary[], sort: SortOption, query = ""): ModelSummary[] {
    if (sort === "relevance") {
        const needle = normalizeSearchText(query.trim());
        return [...models].sort((a, b) => {
            const rankA = matchRank(a, needle) ?? 3;
            const rankB = matchRank(b, needle) ?? 3;
            return rankA - rankB || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
        });
    }
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
