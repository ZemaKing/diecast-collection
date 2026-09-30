import {lazy, Suspense} from "react";
import {Navigate, Route, Routes, useLocation, useParams} from "react-router-dom";
import {AboutPage} from "./pages/about-page/about-page";
import {BrowseDetailPage} from "./pages/browse-page/browse-detail-page";
import {BrowseIndexPage} from "./pages/browse-page/browse-index-page";
import {CollectionPage} from "./pages/collection-page/collection-page";
import {ModelDetailsPage} from "./pages/model-details-page/model-details-page";
import {NotFoundPage} from "./pages/not-found-page/not-found-page";

// Dev-only token reference; the DEV guard lets Vite drop it from production builds.
const TokensPage = import.meta.env.DEV ? lazy(() => import("./pages/dev-tokens/tokens-page")) : null;

// Trucks are retired (ROADMAP Phase 11) and "/" now renders the collection directly, so old
// `/cars`/`/trucks` links (shared URLs, bookmarks, `?model=`/filter query strings) redirect to
// "/" instead of 404ing — preserving the query string and hash so those old links still work
// (an old `?model=<id>` then continues on to `/models/<id>` — see CollectionPage).
function RedirectToCollection() {
    const location = useLocation();
    return <Navigate to={{pathname: "/", search: location.search, hash: location.hash}} replace/>;
}

// Keyed by slug so moving between two brands (or manufacturers) is a fresh page — scroll to top,
// no stale Quick View — rather than React reusing the one instance with a new param.
function BrowseDetailRoute({kind}: {kind: "brands" | "manufacturers"}) {
    const {slug = ""} = useParams();
    return <BrowseDetailPage key={`${kind}:${slug}`} kind={kind}/>;
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<CollectionPage/>}/>
            <Route path="/models/:slug" element={<ModelDetailsPage/>}/>
            {/* Manufacturer & brand browsing (Phase 22) — same components, keyed per kind so
                switching between the two never reuses an instance. */}
            <Route path="/manufacturers" element={<BrowseIndexPage key="manufacturers" kind="manufacturers"/>}/>
            <Route path="/manufacturers/:slug" element={<BrowseDetailRoute kind="manufacturers"/>}/>
            <Route path="/brands" element={<BrowseIndexPage key="brands" kind="brands"/>}/>
            <Route path="/brands/:slug" element={<BrowseDetailRoute kind="brands"/>}/>
            <Route path="/about" element={<AboutPage/>}/>
            <Route path="/cars" element={<RedirectToCollection/>}/>
            <Route path="/trucks" element={<RedirectToCollection/>}/>
            {TokensPage && (
                <Route path="/dev/tokens" element={<Suspense fallback={null}><TokensPage/></Suspense>}/>
            )}
            <Route path="*" element={<NotFoundPage/>}/>
        </Routes>
    );
}
