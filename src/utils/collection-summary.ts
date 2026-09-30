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
