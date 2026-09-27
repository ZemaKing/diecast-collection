import {describe, expect, it, vi} from "vitest";

import {checkSupabaseHealth} from "./supabase-health.ts";

const env = {url: "https://abcdefghijklmnopqrst.supabase.co", anonKey: "sb_publishable_x"};

describe("checkSupabaseHealth", () => {
    it("calls the auth health endpoint with the anon key", async () => {
        const fetchImpl = vi.fn(async () => new Response("{}", {status: 200}));
        const result = await checkSupabaseHealth(env, fetchImpl);
        expect(result.ok).toBe(true);
        expect(fetchImpl).toHaveBeenCalledWith(
            `${env.url}/auth/v1/health`,
            expect.objectContaining({headers: {apikey: env.anonKey}}),
        );
    });

    it("reports a rejected key as an auth error", async () => {
        const result = await checkSupabaseHealth(env, async () => new Response("", {status: 401}));
        expect(result).toMatchObject({ok: false, error: {kind: "auth"}});
    });

    it("reports a paused/down project as unavailable", async () => {
        const result = await checkSupabaseHealth(env, async () => new Response("", {status: 503}));
        expect(result).toMatchObject({ok: false, error: {kind: "unavailable", retryable: true}});
    });

    it("reports being offline as a network error", async () => {
        const result = await checkSupabaseHealth(env, async () => {
            throw new TypeError("Failed to fetch");
        });
        expect(result).toMatchObject({ok: false, error: {kind: "network"}});
    });
});
