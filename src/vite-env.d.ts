/// <reference types="vite/client" />

// Typed `import.meta.env`. Only `VITE_*` variables reach the browser bundle — never put a
// secret (e.g. SUPABASE_SERVICE_ROLE_KEY) here. Keep in sync with `.env.example`.
interface ImportMetaEnv {
    // Optional until Supabase is wired up in Phase 5, where they become required.
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
