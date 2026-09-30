// Copy for the manufacturer & brand pages (ROADMAP Phase 22). Pure, so it's unit-tested.
import type {BrowseEntry, BrowseKind} from "../services/browse.ts";
import type {FacetCount} from "../services/collection-query.ts";
import {BROWSE_LABELS} from "./browse-link.ts";

// "1965–2020", or just "2016" when every model shares a year.
export function formatYears({from, to}: BrowseEntry["years"]): string {
    return from === to ? String(from) : `${from}–${to}`;
}

// The other dimension: "34 brands" on a manufacturer, "1 manufacturer" on a brand.
export function formatRelated(kind: BrowseKind, count: number): string {
    const other = kind === "brands" ? BROWSE_LABELS.manufacturers : BROWSE_LABELS.brands;
    return `${count} ${(count === 1 ? other.singular : other.plural).toLowerCase()}`;
}

// "Racing 60, Rally 40" — the text equivalent of the category mix bar.
export function describeCategories(categories: FacetCount[]): string {
    return categories.map((c) => `${c.name} ${c.count}`).join(", ");
}
