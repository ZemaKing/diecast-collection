// Derived from the already-loaded ModelSummary[] list — no separate DB round trip. The ROADMAP
// read strategy caches one summary list client-side specifically so counts like these are free,
// and nothing here is hard-coded: a newly imported model shows up in every number on the next
// load (ROADMAP Phase 23). `scripts/verify-stats.ts` cross-checks each number against the DB.
import {getBrowseEntries, sortBrowseEntries, type BrowseEntry} from "./browse.ts";
import {EMPTY_FILTERS, getFacetCounts, type FacetCount} from "./collection-query.ts";
import type {CollectionStats, ModelSummary} from "./types.ts";

export function getCollectionStats(models: ModelSummary[]): CollectionStats {
    return {
        totalModels: models.length,
        totalBrands: new Set(models.map((m) => m.brand.slug)).size,
        totalManufacturers: new Set(models.map((m) => m.manufacturer.slug)).size,
        totalCategories: new Set(models.map((m) => m.category.slug)).size,
        scales: [...new Set(models.map((m) => m.scale))].sort(),
    };
}

export type DecadeCount = {
    decade: number; // 1960, 1970, …
    label: string; // "1960s"
    count: number;
};

export type CollectionBreakdown = {
    // Most models first, ties A–Z (the browse pages' "Most models" order).
    brands: BrowseEntry[];
    manufacturers: BrowseEntry[];
    // In the categories' own sort order (Rally, Racing, …), like everywhere else they're listed.
    categories: FacetCount[];
    // Most models first. A model counts once per livery color, as in the Color filter — so these
    // add up to more than the model count whenever a livery is two-tone.
    colors: FacetCount[];
    // Every decade from the oldest model's to the newest's, including empty ones, so the time axis
    // has no silent gaps.
    decades: DecadeCount[];
    racing: {racing: number; road: number};
};

function byCountThenName(a: FacetCount, b: FacetCount): number {
    return b.count - a.count || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
}

export function decadeOf(year: number): number {
    return Math.floor(year / 10) * 10;
}

export function getDecadeCounts(models: ModelSummary[]): DecadeCount[] {
    if (models.length === 0) return [];
    const counts = new Map<number, number>();
    for (const m of models) counts.set(decadeOf(m.year), (counts.get(decadeOf(m.year)) ?? 0) + 1);

    const first = Math.min(...counts.keys());
    const last = Math.max(...counts.keys());
    const decades: DecadeCount[] = [];
    for (let decade = first; decade <= last; decade += 10) {
        decades.push({decade, label: `${decade}s`, count: counts.get(decade) ?? 0});
    }
    return decades;
}

export function getCollectionBreakdown(models: ModelSummary[]): CollectionBreakdown {
    // The same facet counts the collection's filter panel shows (unfiltered).
    const facets = getFacetCounts(models, EMPTY_FILTERS);
    const categoryOrder = new Map(models.map((m) => [m.category.slug, m.category.sortOrder]));
    const racing = models.filter((m) => m.isRacing).length;

    return {
        brands: sortBrowseEntries(getBrowseEntries(models, "brands"), "count"),
        manufacturers: sortBrowseEntries(getBrowseEntries(models, "manufacturers"), "count"),
        categories: [...facets.categories].sort((a, b) =>
            (categoryOrder.get(a.slug) ?? 0) - (categoryOrder.get(b.slug) ?? 0) || a.name.localeCompare(b.name)),
        colors: [...facets.colors].sort(byCountThenName),
        decades: getDecadeCounts(models),
        racing: {racing, road: models.length - racing},
    };
}

// Everyone sharing the highest count ("Top brand" can be a tie) — empty for an empty list.
export function topEntries<T extends {count: number}>(entries: T[]): T[] {
    const max = Math.max(0, ...entries.map((e) => e.count));
    return max === 0 ? [] : entries.filter((e) => e.count === max);
}

// Whole-number percentage of the collection; "<1%" rather than a misleading "0%".
export function formatShare(count: number, total: number): string {
    if (total <= 0) return "0%";
    const pct = (count / total) * 100;
    if (pct > 0 && pct < 1) return "<1%";
    return `${Math.round(pct)}%`;
}
