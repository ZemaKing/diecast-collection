// Collection view modes (ROADMAP Phase 18) — the three toolbar icons in the mockup. A per-viewer
// display preference, so it lives in localStorage, not the URL: a shared link carries what to
// show (filters/search/sort), not how the sender likes to look at it.
//
// Showcase (the mockup's "optional" carousel) is deliberately not here — deferred by the owner.

export const VIEW_MODES = ["grid", "list", "compact"] as const;

export type ViewMode = (typeof VIEW_MODES)[number];

export const DEFAULT_VIEW_MODE: ViewMode = "grid";

export const VIEW_MODE_STORAGE_KEY = "zk-view-mode";

export function isViewMode(value: unknown): value is ViewMode {
    return typeof value === "string" && (VIEW_MODES as readonly string[]).includes(value);
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

// Both helpers are guarded: storage can be missing, throw on access (private windows, blocked
// site data) or hold a stale/garbage value — none of that should break the page, only reset the
// preference to the default.
export function readViewMode(storage: ReadableStorage | null | undefined): ViewMode {
    try {
        const stored = storage?.getItem(VIEW_MODE_STORAGE_KEY);
        return isViewMode(stored) ? stored : DEFAULT_VIEW_MODE;
    } catch {
        return DEFAULT_VIEW_MODE;
    }
}

export function writeViewMode(storage: WritableStorage | null | undefined, mode: ViewMode): void {
    try {
        storage?.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
        // Unavailable/full storage — the mode still applies for this page view.
    }
}

// `window.localStorage` itself throws (not just its methods) when site data is blocked.
export function getLocalStorage(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
}
