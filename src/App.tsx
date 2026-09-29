import {lazy, Suspense} from "react";
import {Navigate, Route, Routes, useLocation} from "react-router-dom";
import {AboutPage} from "./pages/about-page/about-page";
import {CollectionPage} from "./pages/collection-page/collection-page";
import {NotFoundPage} from "./pages/not-found-page/not-found-page";

// Dev-only token reference; the DEV guard lets Vite drop it from production builds.
const TokensPage = import.meta.env.DEV ? lazy(() => import("./pages/dev-tokens/tokens-page")) : null;

// Trucks are retired (ROADMAP Phase 11) and "/" now renders the collection directly, so old
// `/cars`/`/trucks` links (shared URLs, bookmarks, `?model=`/filter query strings) redirect to
// "/" instead of 404ing — preserving the query string and hash so those old links still work.
function RedirectToCollection() {
    const location = useLocation();
    return <Navigate to={{pathname: "/", search: location.search, hash: location.hash}} replace/>;
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<CollectionPage/>}/>
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
