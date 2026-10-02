import {QueryClient} from "@tanstack/react-query";
import {describe, expect, it} from "vitest";

import {queryClientConfig} from "./query-client.ts";

// Phase 29: offline must end in an error state (not an endless skeleton), and a failed read must
// recover by itself on reconnect — which TanStack switches off by default under networkMode "always".
describe("queryClient offline behavior", () => {
    const client = new QueryClient(queryClientConfig);
    const defaults = client.defaultQueryOptions({queryKey: ["x"]});

    it("queries fail fast offline instead of pausing", () => {
        expect(defaults.networkMode).toBe("always");
        expect(client.getDefaultOptions().mutations?.networkMode).toBe("always");
    });

    it("queries still refetch on reconnect", () => {
        expect(defaults.refetchOnReconnect).toBe(true);
    });
});
