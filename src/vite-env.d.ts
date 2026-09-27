/// <reference types="vite/client" />

// Typed `import.meta.env`. Only `VITE_*` variables reach the browser bundle — never put a
// secret (e.g. SUPABASE_SERVICE_ROLE_KEY) here. Keep in sync with `.env.example`.
interface ImportMetaEnv {
    // Typed optional on purpose: presence and format are checked at runtime by parseSupabaseEnv()
    // (src/lib/env.ts), which throws a readable EnvError instead of a vague undefined.
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
