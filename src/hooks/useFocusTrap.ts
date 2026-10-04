// Keyboard focus for a modal panel that isn't a native <dialog> (ROADMAP Phase 34 — the collection's
// filter sheet): while `active`, focus moves into the panel, Tab / Shift+Tab wrap inside it, Escape
// calls `onEscape`, and when it closes (by any route — Escape, scrim, close or apply button) focus
// returns to the element that opened it. Native <dialog>s get all this from useModalDialog().
import {useEffect, useLayoutEffect, useRef, type RefObject} from "react";

import {FOCUSABLE_SELECTOR, wrapFocusTarget} from "../utils/a11y.ts";

type FocusTrapOptions = {
    active: boolean;
    containerRef: RefObject<HTMLElement | null>;
    // Gets focus on open; else the first focusable element in the panel, else the panel itself.
    initialFocusRef?: RefObject<HTMLElement | null>;
    onEscape: () => void;
};

function focusables(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((el) => el.getClientRects().length > 0);
}

export function useFocusTrap({active, containerRef, initialFocusRef, onEscape}: FocusTrapOptions) {
    const onEscapeRef = useRef(onEscape);
    useLayoutEffect(() => {
        onEscapeRef.current = onEscape;
    });

    useEffect(() => {
        const container = containerRef.current;
        if (!active || !container) return;

        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const first = initialFocusRef?.current ?? focusables(container)[0] ?? container;
        first.focus({preventScroll: true});

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onEscapeRef.current();
                return;
            }
            if (e.key !== "Tab") return;
            const current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const target = wrapFocusTarget(focusables(container), current, e.shiftKey);
            if (target) {
                e.preventDefault();
                target.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            // Only when focus was inside the panel (or fell to <body> as it unmounted) — never
            // pull it away from somewhere the user moved it themselves.
            const now = document.activeElement;
            const lost = !now || now === document.body || container.contains(now);
            if (lost && trigger?.isConnected) trigger.focus({preventScroll: true});
        };
    }, [active, containerRef, initialFocusRef]);
}
