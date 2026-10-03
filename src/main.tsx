import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {QueryClientProvider} from '@tanstack/react-query'
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
// Self-hosted Nunito Sans (Phase 33; was Google Fonts): variable weight axis, upright + italic. Each
// file covers one script (unicode-range), so a page downloads only the subsets its text uses.
import "@fontsource-variable/nunito-sans/wght.css";
import "@fontsource-variable/nunito-sans/wght-italic.css";
import "./styles/styles.css";
import App from './App.tsx'
import {queryClient} from './lib/query-client.ts'
import {modelSummariesQuery} from './hooks/model-queries.ts'
import {RouteErrorPage} from './pages/error-page/route-error-page.tsx'

if (import.meta.env.DEV) {
    void import("./lib/dev-connectivity.ts").then((m) => m.reportSupabaseConnectivity());
}

// Every page needs the summary list (the header's "N models" at least), so its request starts now,
// in parallel with React's first render, rather than from that render's effects (Phase 33).
void queryClient.prefetchQuery(modelSummariesQuery);

// A data router whose one splat route renders App's own <Routes> table — the documented way to
// adopt a data router without rewriting the routes. It's needed for useBlocker() (the admin
// form's unsaved-changes guard, Phase 25), which BrowserRouter doesn't support.
// `errorElement` is the route-level error boundary (Phase 29): a page that throws while rendering
// (or a lazy chunk that fails to load) shows RouteErrorPage instead of a blank screen.
const router = createBrowserRouter([{path: "*", element: <App/>, errorElement: <RouteErrorPage/>}]);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router}/>
        </QueryClientProvider>
    </StrictMode>,
);
