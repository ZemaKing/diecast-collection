import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {QueryClientProvider} from '@tanstack/react-query'
import {BrowserRouter} from 'react-router-dom';
import "./styles/styles.css";
import App from './App.tsx'
import {queryClient} from './lib/query-client.ts'

if (import.meta.env.DEV) {
    void import("./lib/dev-connectivity.ts").then((m) => m.reportSupabaseConnectivity());
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </QueryClientProvider>
    </StrictMode>,
);
