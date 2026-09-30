// URL <-> filter/search/sort state (ROADMAP Phase 13, extended Phase 15). This is the single
// source of truth in the URL — no mirrored local state, no sync effects. All functions here are
// pure: they read a URLSearchParams and return a new one, never mutating the input.
import type {CollectionFilters, SortOption} from "../services/collection-query.ts";
import {EMPTY_FILTERS} from "../services/collection-query.ts";
import {slugify} from "./slug.ts";

const FILTER_KEYS = ["brand", "manufacturer", "category", "color"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
const FILTER_KEY_SET: ReadonlySet<string> = new Set(FILTER_KEYS);
const FILTER_KEY_TO_FILTERS_KEY = {
    brand: "brands",
    manufacturer: "manufacturers",
    category: "categories",
    color: "colors",
} as const satisfies Record<FilterKey, keyof CollectionFilters>;

function canonicalValues(filters: CollectionFilters, key: FilterKey): string[] {
    return [...new Set(filters[FILTER_KEY_TO_FILTERS_KEY[key]].map(slugify).filter(Boolean))].sort();
}

// Multi-value, repeated params (`?brand=ford&brand=bmw`). Every raw value — whether it's already
// a canonical slug or a legacy single-value display name from a pre-Phase-13 link (`?brand=Ford`,
// `?color=MULTI`) — is normalized with the same slugify() the importer used to build the DB
// slugs, so both forms resolve to the same value with no separate legacy-parsing branch. Unknown
// slugs are kept (filterModels() just won't match anything against them) rather than dropped, so
// a bad param never silently behaves like "no filter".
export function getCollectionFiltersFromSearchParams(searchParams: URLSearchParams): CollectionFilters {
    const filters = {...EMPTY_FILTERS};
    for (const key of FILTER_KEYS) {
        const values = searchParams.getAll(key).map(slugify).filter(Boolean);
        filters[FILTER_KEY_TO_FILTERS_KEY[key]] = [...new Set(values)];
    }
    return filters;
}

// Returns a copy of `searchParams` with the filter params replaced by `filters`' canonical slugs
// (sorted, so the URL never flickers when the same set is re-applied in a different order); every
// other param (`?model=`, and later `?q=`/`?sort=`) is preserved untouched, in place — rebuilt by
// splicing each filter key's new values in at its *first* original occurrence (like
// `URLSearchParams.set()` does for a single value) rather than deleting-then-re-appending, which
// would move it to the end and make an already-current URL fail the "no-op" check below.
export function applyCollectionFiltersToSearchParams(searchParams: URLSearchParams, filters: CollectionFilters): URLSearchParams {
    const next = new URLSearchParams();
    const written = new Set<FilterKey>();

    for (const [key, value] of searchParams) {
        if (!FILTER_KEY_SET.has(key)) {
            next.append(key, value);
            continue;
        }
        const filterKey = key as FilterKey;
        if (written.has(filterKey)) continue; // later occurrences of the same key were already folded in
        written.add(filterKey);
        for (const v of canonicalValues(filters, filterKey)) next.append(key, v);
    }

    for (const key of FILTER_KEYS) {
        if (written.has(key)) continue;
        for (const v of canonicalValues(filters, key)) next.append(key, v);
    }

    return next;
}

export function getSearchQueryFromSearchParams(searchParams: URLSearchParams): string {
    return searchParams.get("q") ?? "";
}

// Empty/whitespace-only clears the param rather than writing `?q=`.
export function withSearchQuery(searchParams: URLSearchParams, query: string): URLSearchParams {
    const next = new URLSearchParams(searchParams);
    if (query.trim()) next.set("q", query); else next.delete("q");
    return next;
}

const VALID_SORTS: ReadonlySet<string> = new Set<SortOption>([
    "relevance", "added-desc", "added-asc", "name-asc", "name-desc", "year-desc", "year-asc", "manufacturer", "brand",
]);

// null means "absent or unrecognized" — the caller decides the effective default (added-desc, or
// relevance while a search is active), since that decision depends on *other* state (the query)
// that this module has no reason to know about.
export function getSortFromSearchParams(searchParams: URLSearchParams): SortOption | null {
    const raw = searchParams.get("sort");
    return raw !== null && VALID_SORTS.has(raw) ? (raw as SortOption) : null;
}

export function withSort(searchParams: URLSearchParams, sort: SortOption | null): URLSearchParams {
    const next = new URLSearchParams(searchParams);
    if (sort) next.set("sort", sort); else next.delete("sort");
    return next;
}

// `?model=` is no longer written anywhere: models have their own route since Phase 19, and old
// `?model=` links are redirected by getLegacyModelRedirect() (model-link.ts).
