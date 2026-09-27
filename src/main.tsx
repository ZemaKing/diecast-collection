import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom';
import "./styles/styles.css";
import App from './App.tsx'

if (import.meta.env.DEV) {
    void import("./lib/dev-connectivity.ts").then((m) => m.reportSupabaseConnectivity());
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
);
