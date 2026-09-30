// Routes for manufacturer & brand browsing (ROADMAP Phase 22). All pure.
import type {BrowseKind, BrowseSort} from "../services/browse.ts";
import {EMPTY_FILTERS} from "../services/collection-query.ts";
import {collectionPath} from "./model-link.ts";
import {applyCollectionFiltersToSearchParams} from "./url-params.ts";

export function browseIndexPath(kind: BrowseKind): string {
    return `/${kind}`;
}

export function browsePath(kind: BrowseKind, slug: string): string {
    return `/${kind}/${encodeURIComponent(slug)}`;
}

// The full collection filtered to one brand/manufacturer (and the categories picked on its page)
// — where the rest of the filters, search and the other view modes live.
export function browseCollectionPath(kind: BrowseKind, slug: string, categories: string[] = []): string {
    const params = applyCollectionFiltersToSearchParams(new URLSearchParams(), {...EMPTY_FILTERS, [kind]: [slug], categories});
    return collectionPath(`?${params}`);
}

// The index pages' order lives in `?order=` (not `?sort=`, which is the model sort) — "count" is
// the default and is never written.
export function getBrowseSortFromSearchParams(searchParams: URLSearchParams): BrowseSort {
    return searchParams.get("order") === "name" ? "name" : "count";
}

export function withBrowseSort(searchParams: URLSearchParams, sort: BrowseSort): URLSearchParams {
    const next = new URLSearchParams(searchParams);
    if (sort === "name") next.set("order", "name"); else next.delete("order");
    return next;
}

export const BROWSE_LABELS: Record<BrowseKind, {singular: string; plural: string}> = {
    brands: {singular: "Brand", plural: "Brands"},
    manufacturers: {singular: "Manufacturer", plural: "Manufacturers"},
};
