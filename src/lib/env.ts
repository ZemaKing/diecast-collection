// Validates the Supabase env once, with messages that say exactly what to fix.
// Everything here ends up in the browser bundle, so it must only ever see the public
// (anon / publishable) key — a secret key is rejected loudly rather than shipped.

export type SupabaseEnv = {
    url: string;
    anonKey: string;
};

type RawEnv = {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
};

export class EnvError extends Error {
    readonly problems: string[];

    constructor(problems: string[]) {
        super(
            `Supabase is not configured:\n- ${problems.join("\n- ")}\n` +
            "Copy .env.example to .env.local and fill in the values from Supabase → Project Settings → API.",
        );
        this.name = "EnvError";
        this.problems = problems;
    }
}

function decodeJwtRole(token: string): string | null {
    const payload = token.split(".")[1];
    if (!payload) return null;
    try {
        const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        const role = (JSON.parse(json) as {role?: unknown}).role;
        return typeof role === "string" ? role : null;
    } catch {
        return null;
    }
}

const HOSTED_URL = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
const LOCAL_URL = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/;
const JWT = /^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+$/;

export function parseSupabaseEnv(env: RawEnv): SupabaseEnv {
    const problems: string[] = [];
    const url = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
    const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

    if (!url) {
        problems.push("VITE_SUPABASE_URL is missing.");
    } else if (!HOSTED_URL.test(url) && !LOCAL_URL.test(url)) {
        problems.push(
            `VITE_SUPABASE_URL "${url}" is not a Supabase project URL (expected https://<project-ref>.supabase.co, ` +
            "or http://127.0.0.1:54321 for the local stack).",
        );
    }

    if (!anonKey) {
        problems.push("VITE_SUPABASE_ANON_KEY is missing.");
    } else if (anonKey.startsWith("sb_secret_") || decodeJwtRole(anonKey) === "service_role") {
        problems.push(
            "VITE_SUPABASE_ANON_KEY holds a SECRET / service_role key. It would be published in the browser bundle. " +
            "Use the anon (publishable) key instead, and rotate the secret key if it was ever committed or deployed.",
        );
    } else if (!anonKey.startsWith("sb_publishable_") && !JWT.test(anonKey)) {
        problems.push("VITE_SUPABASE_ANON_KEY doesn't look like a Supabase anon/publishable key.");
    }

    if (problems.length) throw new EnvError(problems);
    return {url, anonKey};
}
