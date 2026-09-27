import {describe, expect, it} from "vitest";

import {EnvError} from "./env.ts";
import {isAppError, toAppError, type AppErrorKind} from "./errors.ts";

// Shapes below mirror what supabase-js actually returns/throws.
const pg = (code: string, message = "x") => ({code, message, details: null, hint: null});

describe("toAppError", () => {
    it.each([
        ["unique violation (duplicate slug)", pg("23505"), "conflict"],
        ["FK violation (lookup still in use)", pg("23503"), "conflict"],
        ["check violation", pg("23514"), "validation"],
        ["not-null violation", pg("23502"), "validation"],
        ["bad uuid", pg("22P02"), "validation"],
        ["RLS denial", pg("42501", "new row violates row-level security policy"), "permission"],
        [".single() with 0 rows", pg("PGRST116"), "not_found"],
        ["expired JWT", pg("PGRST301"), "auth"],
        ["auth: wrong password", {name: "AuthApiError", status: 400, code: "invalid_credentials", message: "Invalid login credentials"}, "auth"],
        ["auth: session gone", {name: "AuthApiError", status: 403, code: "session_not_found", message: "x"}, "auth"],
        ["auth: retryable fetch error", {name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch"}, "network"],
        ["browser offline (Chrome)", new TypeError("Failed to fetch"), "network"],
        ["browser offline (Firefox)", new TypeError("NetworkError when attempting to fetch resource."), "network"],
        ["browser offline (Safari)", new TypeError("Load failed"), "network"],
        ["timeout / abort", new DOMException("The operation was aborted.", "AbortError"), "network"],
        ["paused / overloaded project (5xx)", {status: 503, message: "Service Unavailable"}, "unavailable"],
        ["unknown 5xx", {status: 540, message: "Project paused"}, "unavailable"],
        ["HTTP 401", {status: 401, message: "Unauthorized"}, "auth"],
        ["HTTP 403", {status: 403, message: "Forbidden"}, "permission"],
        ["HTTP 404", {status: 404, message: "Not Found"}, "not_found"],
        ["missing env", new EnvError(["VITE_SUPABASE_URL is missing."]), "config"],
        ["plain Error", new Error("boom"), "unknown"],
        ["a string", "boom", "unknown"],
        ["null", null, "unknown"],
    ] as [string, unknown, AppErrorKind][])("%s → %s", (_label, input, kind) => {
        const result = toAppError(input);
        expect(result.kind).toBe(kind);
        expect(result.message).toBeTruthy();
        expect(result.cause).toBe(input);
    });

    it("keeps the original code and status for logging", () => {
        expect(toAppError(pg("23505"))).toMatchObject({code: "23505"});
        expect(toAppError({status: 503})).toMatchObject({status: 503});
    });

    it("marks only transient failures as retryable", () => {
        expect(toAppError(new TypeError("Failed to fetch")).retryable).toBe(true);
        expect(toAppError({status: 503}).retryable).toBe(true);
        expect(toAppError(pg("23505")).retryable).toBe(false);
        expect(toAppError(pg("42501")).retryable).toBe(false);
    });

    it("never shows raw database messages to the user", () => {
        const result = toAppError(pg("42501", 'new row violates row-level security policy for table "models"'));
        expect(result.message).not.toMatch(/row-level|models/);
    });

    it("is idempotent", () => {
        const once = toAppError(pg("23505"));
        expect(isAppError(once)).toBe(true);
        expect(toAppError(once)).toBe(once);
    });

    it("gives a specific message for bad credentials", () => {
        expect(toAppError({name: "AuthApiError", status: 400, code: "invalid_credentials"}).message).toBe("Wrong email or password.");
    });
});
