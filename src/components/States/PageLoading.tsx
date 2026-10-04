import {Header} from "../Header/Header";
import {Skeleton} from "./States.tsx";
import {MAIN_CONTENT_ID} from "../../utils/a11y.ts";

import "../../pages/collection-page/collection-page.css";

// Suspense fallback while a lazily loaded page's code downloads (the admin pages, Phase 29) — the
// shell and a skeleton instead of a blank screen.
export function PageLoading() {

    return (
        <div className="layout">
            <Header/>
            <div className="content">
                <main id={MAIN_CONTENT_ID} tabIndex={-1} className="main pageLoading" aria-busy="true">
                    <span className="visuallyHidden" role="status">Loading page…</span>
                    <Skeleton className="pageLoadingTitle"/>
                    <Skeleton className="pageLoadingBlock"/>
                </main>
            </div>
        </div>
    );
}
