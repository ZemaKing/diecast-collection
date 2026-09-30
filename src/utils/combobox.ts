// Pure logic behind the admin form's searchable pickers (Combobox, Phase 25): which options match
// what was typed, in what order, and whether the typed text is new enough to offer "Add …".
import {normalizeSearchText} from "../services/collection-query.ts";

export type ComboboxOption = {value: string; label: string};

// Diacritic- and case-insensitive ("citro" finds "Citroën"). Labels that start with the query come
// first, then ones where a later word starts with it, then any other match; each tier keeps the
// incoming (alphabetical) order.
export function filterComboboxOptions<T extends ComboboxOption>(options: T[], query: string): T[] {
    const needle = normalizeSearchText(query.trim());
    if (!needle) return options;

    const tiers: T[][] = [[], [], []];
    for (const option of options) {
        const label = normalizeSearchText(option.label);
        const index = label.indexOf(needle);
        if (index === -1) continue;
        if (index === 0) tiers[0].push(option);
        else if (/[\s\-/(]/.test(label[index - 1])) tiers[1].push(option);
        else tiers[2].push(option);
    }
    return tiers.flat();
}

// The exact (case/diacritic-insensitive) option for a typed label, if any — "citroen" → Citroën.
export function findExactOption<T extends ComboboxOption>(options: T[], query: string): T | undefined {
    const needle = normalizeSearchText(query.trim());
    return needle ? options.find((o) => normalizeSearchText(o.label) === needle) : undefined;
}

// "Add “…”" is offered only for text that isn't already an option.
export function canCreateOption(options: ComboboxOption[], query: string): boolean {
    return query.trim().length > 0 && !findExactOption(options, query);
}

// Arrow-key movement through `count` rows (−1 = none active), wrapping at both ends.
export function moveActiveIndex(current: number, delta: 1 | -1, count: number): number {
    if (count === 0) return -1;
    if (current === -1) return delta === 1 ? 0 : count - 1;
    return (current + delta + count) % count;
}
