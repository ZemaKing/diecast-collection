// Page-level scroll handling for routed pages (ROADMAP Phase 19 — the collection ⇄ details round
// trip). BrowserRouter has no <ScrollRestoration> (that's data-router only), and the browser's own
// restoration runs before React has re-rendered the list, so it lands in the wrong place. So:
// - every history entry's scroll position is saved on leaving it (sessionStorage, keyed by
//   `location.key`, so it also survives a refresh — the key lives in history.state);
// - arriving by Back/Forward/refresh (POP) restores it once the page's content is `ready`;
// - arriving by a link (PUSH/REPLACE) starts at the top — or on `focusId`'s element, if given;
// - later navigations that stay on the same page (filters, tabs) leave the scroll alone.
import {useLayoutEffect, useRef} from "react";
import {useLocation, useNavigationType} from "react-router-dom";

const KEY_PREFIX = "zk-scroll:";

function readPosition(key: string): number | null {
    try {
        const raw = window.sessionStorage.getItem(KEY_PREFIX + key);
        const value = raw === null ? NaN : Number(raw);
        return Number.isFinite(value) ? value : null;
    } catch {
        return null;
    }
}

function writePosition(key: string, y: number): void {
    try {
        window.sessionStorage.setItem(KEY_PREFIX + key, String(Math.round(y)));
    } catch {
        // Storage unavailable — Back just won't restore the position.
    }
}

if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
}

export function useScrollRestoration({ready, focusId = null}: {ready: boolean; focusId?: string | null}) {
    const location = useLocation();
    const navigationType = useNavigationType();
    const arrivedRef = useRef(false);
    const handledKeyRef = useRef<string | null>(null);

    // Save when leaving an entry rather than on every scroll: a layout-effect cleanup runs before
    // React removes the old DOM, so window.scrollY still belongs to the entry being left (by the
    // time the new page renders, the shorter document may already have clamped it). `pagehide`
    // covers refresh/close, which unmount nothing. Nothing is saved for an entry whose position
    // hasn't been applied yet (still loading) — that would overwrite the one waiting to be restored.
    useLayoutEffect(() => {
        const key = location.key;
        const save = () => {
            if (handledKeyRef.current === key) writePosition(key, window.scrollY);
        };
        window.addEventListener("pagehide", save);
        return () => {
            window.removeEventListener("pagehide", save);
            save();
        };
    }, [location.key]);

    useLayoutEffect(() => {
        if (handledKeyRef.current === location.key) return;
        const isArrival = !arrivedRef.current;

        if (navigationType === "POP") {
            // Wait for content: restoring against a skeleton would clamp to the wrong offset.
            if (!ready) return;
            handledKeyRef.current = location.key;
            arrivedRef.current = true;
            const y = readPosition(location.key);
            if (y !== null) window.scrollTo(0, y);
            return;
        }

        if (!isArrival) {
            handledKeyRef.current = location.key;
            return;
        }

        if (focusId) {
            if (!ready) return;
            const element = document.getElementById(focusId);
            if (element) {
                element.scrollIntoView({block: "center"});
                element.focus({preventScroll: true});
            } else {
                window.scrollTo(0, 0);
            }
        } else {
            window.scrollTo(0, 0);
        }
        handledKeyRef.current = location.key;
        arrivedRef.current = true;
    }, [location.key, navigationType, ready, focusId]);
}
