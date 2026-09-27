import {lazy, Suspense} from "react";
import {Navigate, Route, Routes} from "react-router-dom";
import {CollectionPage} from "./pages/collection-page/collection-page";
import {LandingPage} from "./pages/landing-page/landing-page";

// Dev-only token reference; the DEV guard lets Vite drop it from production builds.
const TokensPage = import.meta.env.DEV ? lazy(() => import("./pages/dev-tokens/tokens-page")) : null;

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />}/>
            <Route path="/cars" element={<CollectionPage type="cars"/>}/>
            <Route path="/trucks" element={<CollectionPage type="trucks"/>}/>
            {TokensPage && (
                <Route path="/dev/tokens" element={<Suspense fallback={null}><TokensPage/></Suspense>}/>
            )}
            <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
    );
}
