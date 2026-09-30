import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {QueryClientProvider} from '@tanstack/react-query'
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import "./styles/styles.css";
import App from './App.tsx'
import {queryClient} from './lib/query-client.ts'

if (import.meta.env.DEV) {
    void import("./lib/dev-connectivity.ts").then((m) => m.reportSupabaseConnectivity());
}

// A data router whose one splat route renders App's own <Routes> table — the documented way to
// adopt a data router without rewriting the routes. It's needed for useBlocker() (the admin
// form's unsaved-changes guard, Phase 25), which BrowserRouter doesn't support.
const router = createBrowserRouter([{path: "*", element: <App/>}]);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router}/>
        </QueryClientProvider>
    </StrictMode>,
);
