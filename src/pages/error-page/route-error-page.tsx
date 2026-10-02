import {useEffect} from "react";
import {useRouteError} from "react-router-dom";

import {StateIcon} from "../../components/States/StateIcon.tsx";
import {isChunkLoadError} from "../../utils/error-display.ts";

import "../../components/States/States.css";
import "../not-found-page/not-found-page.css";

// The route-level error boundary (ROADMAP Phase 29) — the data router's `errorElement`, so a page
// that throws while rendering shows this instead of a blank screen. Deliberately self-contained:
// no Header, no queries, nothing that could be what just failed. Plain <a>/reload rather than
// router navigation, since the app's state is suspect after a crash. Navigating elsewhere (Back)
// clears it — the router resets its boundary on every location change.
export function RouteErrorPage() {
    const error = useRouteError();
    const staleChunk = isChunkLoadError(error);

    useEffect(() => {
        console.error("[route error]", error);
    }, [error]);

    return (
        <div className="notFoundPage">
            <main className="notFoundMain" role="alert">
                <StateIcon name="error"/>
                <h1 className="notFoundTitle">{staleChunk ? "This page needs a reload" : "Something went wrong"}</h1>
                <p className="notFoundBody">
                    {staleChunk
                        ? "The site was updated while this tab was open. Reload to get the latest version."
                        : "This page hit an unexpected error. Reloading usually fixes it."}
                </p>
                <div className="stateActions">
                    <button type="button" className="stateButton stateButtonPrimary" onClick={() => window.location.reload()}>
                        Reload page
                    </button>
                    <a className="stateButton" href="/">Back to the collection</a>
                </div>
                {import.meta.env.DEV && error instanceof Error && (
                    <pre className="routeErrorDetail">{error.stack ?? error.message}</pre>
                )}
            </main>
        </div>
    );
}
