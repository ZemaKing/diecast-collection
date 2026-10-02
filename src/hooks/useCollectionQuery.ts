// The URL is the single source of truth for collection filters/search/sort (ROADMAP Phase 13,
// extended Phase 15) — all of it is derived from `useSearchParams()` on every render via
// `useMemo`, and updates write straight back to the URL. No `useState` mirror, no `useEffect`
// sync loop (the bug class the old Sidebar had) for filters/sort; the search box needs its own
// brief local staging for the 250ms debounce (see Header.tsx) since typing must feel instant.
import {useCallback, useMemo} from "react";
import {useSearchParams} from "react-router-dom";

import {EMPTY_FILTERS, type CollectionFilters, type SortOption} from "../services/collection-query.ts";
import {
    applyCollectionFiltersToSearchParams,
    getCollectionFiltersFromSearchParams,
    getSearchQueryFromSearchParams,
    getSortFromSearchParams,
    withSearchQuery,
    withSort,
} from "../utils/url-params.ts";

export function useCollectionQuery() {
    const [searchParams, setSearchParams] = useSearchParams();

    const filters = useMemo(() => getCollectionFiltersFromSearchParams(searchParams), [searchParams]);
    const query = getSearchQueryFromSearchParams(searchParams);

    // No explicit ?sort=: default to relevance while actively searching (an untouched sort
    // shouldn't visually ignore what you just typed), otherwise the toolbar's stated default.
    const explicitSort = getSortFromSearchParams(searchParams);
    const sort: SortOption = explicitSort ?? (query.trim() ? "relevance" : "added-desc");

    const toggleFilter = useCallback((key: keyof CollectionFilters, value: string) => {
        setSearchParams((current) => {
            const currentFilters = getCollectionFiltersFromSearchParams(current);
            const selected = currentFilters[key];
            const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
            return applyCollectionFiltersToSearchParams(current, {...currentFilters, [key]: next});
        }, {replace: false});
    }, [setSearchParams]);

    const clearFilters = useCallback(() => {
        setSearchParams((current) => applyCollectionFiltersToSearchParams(current, EMPTY_FILTERS), {replace: false});
    }, [setSearchParams]);

    // The empty state's "Clear search" (Phase 29); the header's search box follows the URL.
    const clearQuery = useCallback(() => {
        setSearchParams((current) => withSearchQuery(current, ""), {replace: false});
    }, [setSearchParams]);

    const setSort = useCallback((value: SortOption) => {
        setSearchParams((current) => withSort(current, value), {replace: false});
    }, [setSearchParams]);

    return {filters, query, sort, toggleFilter, clearFilters, clearQuery, setSort};
}
