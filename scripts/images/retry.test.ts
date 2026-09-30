import {describe, expect, it, vi} from "vitest";

import {backoffDelay, HttpError, isRetryable, PermanentError, withRetry} from "./retry.ts";

const noSleep = () => Promise.resolve();

describe("isRetryable", () => {
    it("retries network errors, timeouts, 408/425/429 and 5xx", () => {
        expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
        expect(isRetryable(new DOMException("timed out", "TimeoutError"))).toBe(true);
        for (const status of [408, 425, 429, 500, 502, 503]) expect(isRetryable(new HttpError(status, ""))).toBe(true);
        expect(isRetryable({status: 503, message: "supabase-js error"})).toBe(true);
    });

    it("does not retry other HTTP statuses or permanent errors", () => {
        for (const status of [400, 401, 403, 404, 413]) expect(isRetryable(new HttpError(status, ""))).toBe(false);
        expect(isRetryable({status: 404, message: "Object not found"})).toBe(false);
        expect(isRetryable(new PermanentError("not an image"))).toBe(false);
    });
});

describe("withRetry", () => {
    it("returns after transient failures", async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new TypeError("fetch failed"))
            .mockRejectedValueOnce(new HttpError(503, "busy"))
            .mockResolvedValue("ok");
        const onRetry = vi.fn();
        await expect(withRetry(fn, {retries: 4, sleep: noSleep, onRetry})).resolves.toBe("ok");
        expect(fn).toHaveBeenCalledTimes(3);
        expect(onRetry.mock.calls.map((c) => c[0])).toEqual([1, 2]);
    });

    it("gives up after `retries` retries", async () => {
        const fn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
        await expect(withRetry(fn, {retries: 2, sleep: noSleep})).rejects.toThrow("fetch failed");
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("fails at once on a non-retryable error", async () => {
        const fn = vi.fn().mockRejectedValue(new HttpError(404, "gone"));
        await expect(withRetry(fn, {retries: 4, sleep: noSleep})).rejects.toThrow("gone");
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe("backoffDelay", () => {
    it("doubles per attempt, adds up to 50% jitter, and is capped", () => {
        expect(backoffDelay(1, 500, 15_000, () => 0)).toBe(500);
        expect(backoffDelay(3, 500, 15_000, () => 0)).toBe(2000);
        expect(backoffDelay(3, 500, 15_000, () => 1)).toBe(3000);
        expect(backoffDelay(10, 500, 15_000, () => 0)).toBe(15_000);
    });
});
