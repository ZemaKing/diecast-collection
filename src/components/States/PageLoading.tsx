import {Header} from "../Header/Header";
import {useModelCount} from "../../hooks/useModelCount.ts";
import {Skeleton} from "./States.tsx";

import "../../pages/collection-page/collection-page.css";

// Suspense fallback while a lazily loaded page's code downloads (the admin pages, Phase 29) — the
// shell and a skeleton instead of a blank screen.
export function PageLoading() {
    const count = useModelCount();

    return (
        <div className="layout">
            <Header count={count}/>
            <div className="content">
                <main className="main pageLoading" aria-busy="true">
                    <span className="visuallyHidden" role="status">Loading page…</span>
                    <Skeleton className="pageLoadingTitle"/>
                    <Skeleton className="pageLoadingBlock"/>
                </main>
            </div>
        </div>
    );
}
