import {describe, expect, it} from "vitest";

import {toAppError} from "../lib/errors.ts";
import {describeError, isChunkLoadError, isPausedProject} from "./error-display.ts";

const offlineFetch = toAppError(new TypeError("Failed to fetch"));

describe("describeError", () => {
    it("a network failure while the browser is offline → offline, retryable", () => {
        expect(describeError(offlineFetch, {online: false})).toMatchObject({variant: "offline", title: "You're offline", canRetry: true});
    });

    it("a network failure while online → the server is unreachable (mentions a paused database)", () => {
        const display = describeError(offlineFetch, {online: true});
        expect(display).toMatchObject({variant: "unreachable", canRetry: true});
        expect(display.message).toMatch(/paused/);
    });

    it("HTTP 540 (Supabase's paused project) → paused", () => {
        expect(describeError(toAppError({status: 540, message: "Project paused"}), {online: true})).toMatchObject({variant: "paused", canRetry: true});
    });

    it("a 5xx whose message says paused → paused", () => {
        expect(describeError(toAppError({status: 503, message: "Project is paused"}), {online: true}).variant).toBe("paused");
    });

    it("any other 5xx → temporarily unavailable", () => {
        expect(describeError(toAppError({status: 503, message: "Service Unavailable"}), {online: true})).toMatchObject({variant: "unavailable", canRetry: true});
    });

    it("being offline doesn't relabel a non-network error", () => {
        expect(describeError(toAppError({status: 503, message: "x"}), {online: false}).variant).toBe("unavailable");
    });

    it("a configuration error can't be fixed by retrying", () => {
        expect(describeError({kind: "config", message: "x", retryable: false}, {online: true})).toMatchObject({variant: "config", canRetry: false});
    });

    it("anything else shows the AppError's own message and retryability", () => {
        expect(describeError({kind: "permission", message: "No.", retryable: false}, {online: true})).toEqual({
            variant: "generic", title: "Something went wrong", message: "No.", canRetry: false,
        });
        expect(describeError(toAppError(new Error("boom")), {online: true}).canRetry).toBe(true);
    });
});

describe("isPausedProject", () => {
    it("only for 540 or an unavailable error that says paused", () => {
        expect(isPausedProject(toAppError({status: 540, message: ""}))).toBe(true);
        expect(isPausedProject(toAppError({status: 502, message: "Bad gateway"}))).toBe(false);
        expect(isPausedProject({kind: "unknown", message: "paused", retryable: true, cause: {message: "paused"}})).toBe(false);
    });
});

describe("isChunkLoadError", () => {
    it.each([
        ["Chrome", "Failed to fetch dynamically imported module: https://x/assets/a.js"],
        ["Firefox", "error loading dynamically imported module: https://x/assets/a.js"],
        ["Safari", "Importing a module script failed."],
    ])("%s's lazy-chunk failure", (_browser, message) => {
        expect(isChunkLoadError(new TypeError(message))).toBe(true);
    });

    it("not for other errors", () => {
        expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
        expect(isChunkLoadError(null)).toBe(false);
    });
});
