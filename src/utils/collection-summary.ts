// Copy for the collection hero and the results header (ROADMAP Phase 17). Pure, so the wording
// rules (singular/plural, "N of M", active-state suffixes) are unit-tested instead of living inline
// in JSX.

export function pluralizeModels(count: number): string {
    return count === 1 ? "model" : "models";
}

// "A personal collection of 1:43 scale models" while the whole collection shares one scale (today:
// all 227 are 1:43); falls back to scale-agnostic wording the moment a second scale is added, so the
// hero never states something the data contradicts.
export function heroSubtitle(scales: string[]): string {
    return scales.length === 1
        ? `A personal collection of ${scales[0]} scale models`
        : "A personal collection of diecast scale models";
}

export type ResultsSummaryInput = {
    visible: number;
    total: number;
    activeFilterCount: number;
    query: string;
};

export type ResultsSummary = {
    // Always present: "227 models" / "29 of 227 models".
    count: string;
    // Only when something narrows the list: 'matching "ford" · 2 filters'.
    detail: string | null;
    isNarrowed: boolean;
};

export function describeResults({visible, total, activeFilterCount, query}: ResultsSummaryInput): ResultsSummary {
    const trimmed = query.trim();
    const isNarrowed = activeFilterCount > 0 || trimmed !== "";

    if (!isNarrowed) {
        return {count: `${total} ${pluralizeModels(total)}`, detail: null, isNarrowed};
    }

    const parts: string[] = [];
    if (trimmed) parts.push(`matching "${trimmed}"`);
    if (activeFilterCount > 0) parts.push(`${activeFilterCount} ${activeFilterCount === 1 ? "filter" : "filters"}`);

    return {
        count: `${visible} of ${total} ${pluralizeModels(total)}`,
        detail: parts.join(" · "),
        isNarrowed,
    };
}

export type EmptyResultsInput = {
    total: number;
    activeFilterCount: number;
    query: string;
};

export type EmptyResults = {
    kind: "no-models" | "no-search-results" | "no-filter-results" | "no-search-and-filter-results";
    title: string;
    message: string;
    // Which ways out the empty state offers.
    canClearSearch: boolean;
    canClearFilters: boolean;
};

// The collection's empty states (ROADMAP Phase 29): an empty collection, a search that matches
// nothing, filters that match nothing, or both — each says why and offers the matching way out.
export function describeEmptyResults({total, activeFilterCount, query}: EmptyResultsInput): EmptyResults {
    const trimmed = query.trim();
    const filters = `${activeFilterCount} ${activeFilterCount === 1 ? "filter" : "filters"}`;

    if (total === 0) {
        return {
            kind: "no-models",
            title: "No models yet",
            message: "The collection is empty for now — models show up here as soon as they're added.",
            canClearSearch: false,
            canClearFilters: false,
        };
    }

    if (trimmed && activeFilterCount > 0) {
        return {
            kind: "no-search-and-filter-results",
            title: `No models match "${trimmed}" with ${filters}`,
            message: "Try clearing the filters to search the whole collection, or change the search.",
            canClearSearch: true,
            canClearFilters: true,
        };
    }

    if (trimmed) {
        return {
            kind: "no-search-results",
            title: `No models match "${trimmed}"`,
            message: "Search looks at names, brands, manufacturers, years, categories, drivers and car numbers. Check the spelling or try a shorter word.",
            canClearSearch: true,
            canClearFilters: false,
        };
    }

    return {
        kind: "no-filter-results",
        title: activeFilterCount === 1 ? "No models match this filter" : `No models match these ${filters}`,
        message: activeFilterCount === 1 ? "Try a different one, or clear it to see the whole collection." : "Try removing one of them, or clear them all.",
        canClearSearch: false,
        canClearFilters: true,
    };
}
