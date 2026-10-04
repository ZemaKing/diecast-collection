import {useEffect} from "react";

import {formatPageTitle} from "../utils/a11y.ts";

// Every page names itself in the browser tab / screen-reader page title (ROADMAP Phase 34 — before,
// every route was "ZemaKing Diecast Collection"). `""` = the site name alone (the collection);
// `null` = still loading — leaves the current title rather than flashing a placeholder.
export function usePageTitle(title: string | null) {
    useEffect(() => {
        if (title === null) return;
        document.title = formatPageTitle(title);
    }, [title]);
}
