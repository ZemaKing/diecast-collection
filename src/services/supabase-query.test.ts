import {describe, expect, it} from "vitest";

import {unwrap} from "./supabase-query.ts";

describe("unwrap", () => {
    it("returns the data", async () => {
        await expect(unwrap(Promise.resolve({data: [1], error: null, status: 200}))).resolves.toEqual([1]);
    });

    it("a Postgres code still decides the kind, whatever the status", async () => {
        await expect(unwrap(Promise.resolve({data: null, error: {message: "dup", code: "23505"}, status: 409}))).rejects.toMatchObject({kind: "conflict"});
    });

    it("an error without a code is classified by the HTTP status (a paused project answers 540)", async () => {
        await expect(unwrap(Promise.resolve({data: null, error: {message: "Project paused", code: ""}, status: 540})))
            .rejects.toMatchObject({kind: "unavailable", status: 540, retryable: true});
    });

    it("no data → not_found", async () => {
        await expect(unwrap(Promise.resolve({data: null, error: null, status: 200}))).rejects.toMatchObject({kind: "not_found"});
    });
});
