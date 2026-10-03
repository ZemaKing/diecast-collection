import {describe, expect, it} from "vitest";

// The installed supabase-js ESM build (its package.json "module") — what Vite bundles.
import source from "../../node_modules/@supabase/supabase-js/dist/index.mjs?raw";

import {RealtimeClient} from "./realtime-stub.ts";

describe("realtime stub (aliased for @supabase/realtime-js in vite.config.ts)", () => {
    it("covers every method SupabaseClient calls on its realtime client", () => {
        const called = new Set([...source.matchAll(/this\.realtime\.(\w+)/g)].map((m) => m[1]!));
        expect(called.size).toBeGreaterThan(0);
        for (const method of called) {
            expect(typeof (RealtimeClient.prototype as unknown as Record<string, unknown>)[method], `RealtimeClient.${method}`).toBe("function");
        }
    });

    it("is the only name supabase-js imports from realtime-js", () => {
        const imports = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']@supabase\/realtime-js["']/g)]
            .flatMap((m) => m[1]!.split(",").map((name) => name.trim()).filter(Boolean));
        expect(imports).toEqual(["RealtimeClient"]);
    });

    it("refuses to open a channel rather than failing silently", () => {
        expect(() => new RealtimeClient().channel()).toThrow(/isn't bundled/);
    });
});
