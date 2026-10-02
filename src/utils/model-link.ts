// Links between the collection and the model details page (ROADMAP Phase 19). All pure.

export function modelPath(slug: string): string {
    return `/models/${encodeURIComponent(slug)}`;
}

// The admin model form (Phase 25). The slug is stable, so an edit link never goes stale.
export const NEW_MODEL_PATH = "/admin/models/new";
// Supporting data — brands, manufacturers, drivers, tags, colors, categories (Phase 28).
export const SUPPORTING_DATA_PATH = "/admin/data";

export function editModelPath(slug: string): string {
    return `/admin/models/${encodeURIComponent(slug)}/edit`;
}

// A one-line confirmation an admin action hands to the page it lands on ("Saved …", "Deleted …"),
// carried in router state — never in the URL, so it can't be shared or bookmarked.
export type AdminNoticeState = {adminNotice?: string};

export function readAdminNotice(state: unknown): string | null {
    const value = (state as AdminNoticeState | null)?.adminNotice;
    return typeof value === "string" && value ? value : null;
}

// Router location state carried from the collection to a model and back:
// - `collectionSearch`: the collection's query string when the model was opened, so "Collection"
//   in the breadcrumb returns to the same filters/search/sort.
// - `focusModel`: set on the way back, so the collection can bring that model's item into view.
export type ModelLinkState = {
    collectionSearch?: string;
    focusModel?: string;
};

// Location state lives in `history.state` — it survives refresh, but it's still untrusted input
// (another page on the origin, an old app version). Only a query string (or nothing) is accepted.
export function readCollectionSearch(state: unknown): string {
    const value = (state as ModelLinkState | null)?.collectionSearch;
    return typeof value === "string" && (value === "" || value.startsWith("?")) ? value : "";
}

export function readFocusModel(state: unknown): string | null {
    const value = (state as ModelLinkState | null)?.focusModel;
    return typeof value === "string" && value ? value : null;
}

// The collection URL with the given query string, dropping a lone "?".
export function collectionPath(search: string): string {
    return search && search !== "?" ? `/${search}` : "/";
}

export type LegacyModelRedirect = {
    to: string;
    state: ModelLinkState;
};

// Pre-Phase-19 shared links opened a modal via `/?model=<id>` (and `/cars?model=<id>`). The legacy
// `id` is the `models.slug` verbatim (docs/SCHEMA.md), so it maps straight onto the details route.
// Any other params (filters, `?q=`, `?sort=`) the link carried become the page's way back.
export function getLegacyModelRedirect(searchParams: URLSearchParams): LegacyModelRedirect | null {
    const slug = searchParams.get("model")?.trim();
    if (!slug) return null;

    const rest = new URLSearchParams(searchParams);
    rest.delete("model");
    const search = rest.toString();

    return {to: modelPath(slug), state: {collectionSearch: search ? `?${search}` : ""}};
}
