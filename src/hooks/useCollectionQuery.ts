// The URL is the single source of truth for collection filters (ROADMAP Phase 13) — filters are
// derived from `useSearchParams()` on every render via `useMemo`, and updates write straight back
// to the URL. No `useState` mirror, no `useEffect` sync loop (the bug class the old Sidebar had).
import {useCallback, useMemo} from "react";
import {useSearchParams} from "react-router-dom";

import {EMPTY_FILTERS, type CollectionFilters} from "../services/collection-query.ts";
import {applyCollectionFiltersToSearchParams, getCollectionFiltersFromSearchParams} from "../utils/url-params.ts";

export function useCollectionQuery() {
    const [searchParams, setSearchParams] = useSearchParams();

    const filters = useMemo(() => getCollectionFiltersFromSearchParams(searchParams), [searchParams]);

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

    return {filters, toggleFilter, clearFilters};
}
