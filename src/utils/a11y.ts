// Pure helpers behind the Phase 34 accessibility hooks (usePageTitle, useFocusTrap,
// useFocusOnNavigation) — kept here so they're unit-tested without a DOM.

export const SITE_NAME = "ZemaKing Diecast Collection";
export const MAIN_CONTENT_ID = "main-content";

// "Porsche 911 GT3 RS" → "Porsche 911 GT3 RS · ZemaKing Diecast Collection"; no/blank title → the
// site name alone (the collection, and pages still loading their data).
export function formatPageTitle(title?: string | null): string {
    const trimmed = title?.trim();
    return trimmed ? `${trimmed} · ${SITE_NAME}` : SITE_NAME;
}

// What can take keyboard focus inside a container (visibility is checked by the caller).
export const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "summary",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

// Where Tab should land inside a focus trap, given the trap's focusable elements in order. Wraps
// last → first (first → last with Shift) and pulls focus back in from outside; `null` means the
// browser's own move is already right (it stays inside).
export function wrapFocusTarget<T>(items: readonly T[], current: T | null, backwards: boolean): T | null {
    if (items.length === 0) return null;
    const index = current === null ? -1 : items.indexOf(current);
    if (index === -1) return backwards ? items[items.length - 1] : items[0];
    if (!backwards && index === items.length - 1) return items[0];
    if (backwards && index === 0) return items[items.length - 1];
    return null;
}
