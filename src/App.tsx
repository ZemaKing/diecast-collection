import {lazy, Suspense} from "react";
import {Navigate, Route, Routes, useLocation, useParams} from "react-router-dom";
import {AdminRoute} from "./components/AdminRoute/AdminRoute";
import {useResetQueriesOnUserChange} from "./hooks/useSession";
import {AboutPage} from "./pages/about-page/about-page";
import {AdminHomePage} from "./pages/admin/admin-home-page";
import {BrowseDetailPage} from "./pages/browse-page/browse-detail-page";
import {BrowseIndexPage} from "./pages/browse-page/browse-index-page";
import {CollectionPage} from "./pages/collection-page/collection-page";
import {ModelDetailsPage} from "./pages/model-details-page/model-details-page";
import {LoginPage} from "./pages/login-page/login-page";
import {NotFoundPage} from "./pages/not-found-page/not-found-page";
import {StatisticsPage} from "./pages/statistics-page/statistics-page";

// The model form (Phase 25) is for the owner only — its own chunk, so visitors never download it.
const NewModelPage = lazy(() => import("./pages/admin/model-form-page").then((m) => ({default: m.NewModelPage})));
const EditModelPage = lazy(() => import("./pages/admin/model-form-page").then((m) => ({default: m.EditModelPage})));

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
    // Cached reads depend on who's asking (RLS) — reset them when the signed-in user changes.
    useResetQueriesOnUserChange();

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
            <Route path="/statistics" element={<StatisticsPage/>}/>
            <Route path="/about" element={<AboutPage/>}/>
            {/* Owner sign-in and the guarded admin area (Phase 24). Public pages never need auth. */}
            <Route path="/login" element={<LoginPage/>}/>
            <Route path="/admin" element={<AdminRoute/>}>
                <Route index element={<AdminHomePage/>}/>
                {/* The model form (Phase 25). */}
                <Route path="models/new" element={<Suspense fallback={null}><NewModelPage/></Suspense>}/>
                <Route path="models/:slug/edit" element={<Suspense fallback={null}><EditModelPage/></Suspense>}/>
                <Route path="*" element={<NotFoundPage/>}/>
            </Route>
            <Route path="/cars" element={<RedirectToCollection/>}/>
            <Route path="/trucks" element={<RedirectToCollection/>}/>
            {TokensPage && (
                <Route path="/dev/tokens" element={<Suspense fallback={null}><TokensPage/></Suspense>}/>
            )}
            <Route path="*" element={<NotFoundPage/>}/>
        </Routes>
    );
}
