// Manufacturer & brand browsing (ROADMAP Phase 22). Pure, over the already-loaded ModelSummary[]
// list — the same list (and the same query cache) the collection page filters, so a browse
// page's counts are the filter panel's counts by construction, with no extra round trip. Only
// brands/manufacturers that actually have (published) models appear: a lookup row with nothing
// in the collection has nothing to browse.
import {filterModels, getFacetCounts, EMPTY_FILTERS, type FacetCount} from "./collection-query.ts";
import type {LookupRef, ModelSummary} from "./types.ts";

export type BrowseKind = "brands" | "manufacturers";

export type BrowseEntry = LookupRef & {
    count: number;
    // Categories represented, most models first (ties: category sort order, then name).
    categories: FacetCount[];
    years: {from: number; to: number};
    // The other dimension: how many manufacturers made this brand's models, or how many brands a
    // manufacturer's models cover.
    relatedCount: number;
};

export type BrowseSort = "count" | "name";

export function browseRef(model: ModelSummary, kind: BrowseKind): LookupRef {
    return kind === "brands" ? model.brand : model.manufacturer;
}

function relatedRef(model: ModelSummary, kind: BrowseKind): LookupRef {
    return kind === "brands" ? model.manufacturer : model.brand;
}

// The models a brand/manufacturer page shows — the same predicate as the collection's
// `?brand=`/`?manufacturer=` filter, so the two can never disagree.
export function getBrowseModels(models: ModelSummary[], kind: BrowseKind, slug: string): ModelSummary[] {
    return filterModels(models, {...EMPTY_FILTERS, [kind]: [slug]});
}

function buildEntry(ref: LookupRef, models: ModelSummary[], kind: BrowseKind): BrowseEntry {
    const sortOrder = new Map(models.map((m) => [m.category.slug, m.category.sortOrder]));
    const categories = getFacetCounts(models, EMPTY_FILTERS).categories.sort((a, b) =>
        b.count - a.count || (sortOrder.get(a.slug) ?? 0) - (sortOrder.get(b.slug) ?? 0) || a.name.localeCompare(b.name));
    const years = models.map((m) => m.year);

    return {
        ...ref,
        count: models.length,
        categories,
        years: {from: Math.min(...years), to: Math.max(...years)},
        relatedCount: new Set(models.map((m) => relatedRef(m, kind).slug)).size,
    };
}

// One entry per brand/manufacturer present in `models`, A–Z.
export function getBrowseEntries(models: ModelSummary[], kind: BrowseKind): BrowseEntry[] {
    const groups = new Map<string, {ref: LookupRef; models: ModelSummary[]}>();
    for (const model of models) {
        const ref = browseRef(model, kind);
        const group = groups.get(ref.slug) ?? {ref, models: []};
        group.models.push(model);
        groups.set(ref.slug, group);
    }
    return sortBrowseEntries([...groups.values()].map((g) => buildEntry(g.ref, g.models, kind)), "name");
}

// null → no model has that brand/manufacturer (an unknown slug, or one with nothing in it) → 404.
export function getBrowseEntry(models: ModelSummary[], kind: BrowseKind, slug: string): BrowseEntry | null {
    const matching = getBrowseModels(models, kind, slug);
    const first = matching[0];
    return first ? buildEntry(browseRef(first, kind), matching, kind) : null;
}

// "count": most models first (the collection's centre of gravity up top), ties A–Z.
export function sortBrowseEntries(entries: BrowseEntry[], sort: BrowseSort): BrowseEntry[] {
    const byName = (a: BrowseEntry, b: BrowseEntry) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
    return [...entries].sort(sort === "count" ? (a, b) => b.count - a.count || byName(a, b) : byName);
}
