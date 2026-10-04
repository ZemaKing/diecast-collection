// The Supabase project the production build under test talks to: the same VITE_* values Vite
// bakes into `npm run build` (shell env first, then .env.local). Only the PUBLIC anon key.
import fs from "node:fs";

let cached: {url: string; anonKey: string} | null = null;

export function loadEnv(): {url: string; anonKey: string} {
    if (cached) return cached;
    if (!process.env.VITE_SUPABASE_URL && fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
    const url = process.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (!url || !anonKey) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing (.env.local) — the E2E suite reads the live collection.");
    cached = {url, anonKey};
    return cached;
}
