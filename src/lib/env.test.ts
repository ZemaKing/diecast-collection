import {describe, expect, it} from "vitest";

import {EnvError, parseSupabaseEnv} from "./env.ts";

// Fake (unsigned) JWTs — only the payload's `role` matters to the parser.
const b64url = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (payload: object) => `${b64url({alg: "HS256", typ: "JWT"})}.${b64url(payload)}.c2lnbmF0dXJl`;

const URL = "https://abcdefghijklmnopqrst.supabase.co";
const ANON_JWT = jwt({role: "anon", iss: "supabase"});

function problemsOf(env: Parameters<typeof parseSupabaseEnv>[0]): string[] {
    try {
        parseSupabaseEnv(env);
        return [];
    } catch (error) {
        expect(error).toBeInstanceOf(EnvError);
        return (error as EnvError).problems;
    }
}

describe("parseSupabaseEnv", () => {
    it("accepts a hosted URL with a legacy anon JWT", () => {
        expect(parseSupabaseEnv({VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: ANON_JWT})).toEqual({url: URL, anonKey: ANON_JWT});
    });

    it("accepts a new-style publishable key and the local stack URL", () => {
        const env = {VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_SUPABASE_ANON_KEY: "sb_publishable_abc123"};
        expect(parseSupabaseEnv(env).url).toBe("http://127.0.0.1:54321");
    });

    it("trims whitespace and trailing slashes", () => {
        expect(parseSupabaseEnv({VITE_SUPABASE_URL: ` ${URL}/ `, VITE_SUPABASE_ANON_KEY: ` ${ANON_JWT} `}))
            .toEqual({url: URL, anonKey: ANON_JWT});
    });

    it("reports every missing variable at once", () => {
        expect(problemsOf({})).toEqual(["VITE_SUPABASE_URL is missing.", "VITE_SUPABASE_ANON_KEY is missing."]);
        expect(problemsOf({VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "   "})).toHaveLength(2);
    });

    it("rejects non-Supabase URLs", () => {
        expect(problemsOf({VITE_SUPABASE_URL: "https://example.com", VITE_SUPABASE_ANON_KEY: ANON_JWT})[0])
            .toMatch(/not a Supabase project URL/);
        expect(problemsOf({VITE_SUPABASE_URL: "http://abcdefghijklmnopqrst.supabase.co", VITE_SUPABASE_ANON_KEY: ANON_JWT}))
            .toHaveLength(1);
    });

    it("REJECTS a service_role JWT so it can never reach the browser bundle", () => {
        const problems = problemsOf({VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: jwt({role: "service_role"})});
        expect(problems[0]).toMatch(/SECRET \/ service_role/);
    });

    it("REJECTS a new-style secret key", () => {
        expect(problemsOf({VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: "sb_secret_abc"})[0]).toMatch(/SECRET/);
    });

    it("rejects garbage keys", () => {
        expect(problemsOf({VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: "hello"})[0]).toMatch(/doesn't look like/);
    });

    it("error message tells you how to fix it", () => {
        expect(() => parseSupabaseEnv({})).toThrow(/\.env\.local/);
    });
});
