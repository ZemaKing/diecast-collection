// After an in-app navigation to another page, move keyboard focus to the new page's <h1> (or its
// <main>), so a screen reader announces where you landed and Tab continues from the content — the
// SPA equivalent of a page load (ROADMAP Phase 34). Called by Header, which every page renders.
// - The session's first page (router key "default") is left alone, like a real page load — keyed
//   on its path, since replace-navigations on load (the header search's ?q= sync) change the key.
// - Search/filter changes keep the same path, so they never move focus.
// - Anything that already placed focus wins (the collection's return-to-model focus, the header
//   search box carrying typing across pages): this only acts while focus is on <body>.
import {useEffect, useRef} from "react";
import {useLocation} from "react-router-dom";

import {MAIN_CONTENT_ID} from "../utils/a11y.ts";

// A page whose heading waits for its data (the details page) gets this long to render it before
// focus settles for <main>.
const HEADING_WAIT_FRAMES = 90;

export function useFocusOnNavigation() {
    const {pathname, key} = useLocation();
    const firstPagePath = useRef(key === "default" ? pathname : null);

    useEffect(() => {
        if (pathname === firstPagePath.current) return;

        let frame = 0;
        let waited = 0;
        const tick = () => {
            const active = document.activeElement;
            if (active && active !== document.body) return;
            const main = document.getElementById(MAIN_CONTENT_ID);
            const heading = main?.querySelector<HTMLElement>("h1");
            if (heading) {
                if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
                heading.focus({preventScroll: true});
            } else if (waited++ < HEADING_WAIT_FRAMES) {
                frame = requestAnimationFrame(tick);
            } else {
                main?.focus({preventScroll: true});
            }
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [pathname]);
}
