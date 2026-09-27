// The ONE Supabase client for the app. Only src/lib and src/services may import it
// (enforced by ESLint from ROADMAP Phase 9); components go through services.
//
// Importing this module validates the env and throws EnvError if it's missing or unsafe —
// deliberately loud. Nothing in the current UI imports it yet (cars still read JSON until Phase 10).
import {createClient} from "@supabase/supabase-js";

import type {Database} from "./database.types.ts";
import {parseSupabaseEnv} from "./env.ts";

// All app tables live in their own Postgres schema instead of `public`, so the data can be moved or
// co-hosted with a single `pg_dump --schema=diecast`. See docs/SUPABASE-SETUP.md.
export const DB_SCHEMA = "diecast";

export const supabaseEnv = parseSupabaseEnv(import.meta.env);

export const supabase = createClient<Database, typeof DB_SCHEMA>(supabaseEnv.url, supabaseEnv.anonKey, {
    db: {schema: DB_SCHEMA},
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // App-specific key instead of the default sb-<ref>-auth-token, so it's easy to spot and clear.
        storageKey: "zk-diecast-auth",
    },
});
