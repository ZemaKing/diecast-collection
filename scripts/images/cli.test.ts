import {describe, expect, it} from "vitest";

import {parseArgs} from "./cli.ts";

describe("parseArgs", () => {
    it("defaults to a dry-run upload", () => {
        expect(parseArgs(["job.ts"])).toEqual({jobPath: "job.ts", command: "upload", apply: false, force: false, full: false, only: null, limit: null});
        expect(parseArgs(["job.ts", "upload", "--dry-run"]).apply).toBe(false);
    });

    it("reads the flags", () => {
        expect(parseArgs(["job.ts", "upload", "--apply", "--force", "--only=a/0, b/0", "--limit=5"]))
            .toMatchObject({apply: true, force: true, only: ["a/0", "b/0"], limit: 5});
        expect(parseArgs(["job.ts", "verify", "--full"])).toMatchObject({command: "verify", full: true});
    });

    it("rejects bad input", () => {
        expect(() => parseArgs([])).toThrow("Usage");
        expect(() => parseArgs(["job.ts", "delete"])).toThrow("Unknown command");
        expect(() => parseArgs(["job.ts", "--apply", "--dry-run"])).toThrow("mutually exclusive");
        expect(() => parseArgs(["job.ts", "--limit=0"])).toThrow("positive integer");
        expect(() => parseArgs(["job.ts", "--aply"])).toThrow("--aply");
    });
});
