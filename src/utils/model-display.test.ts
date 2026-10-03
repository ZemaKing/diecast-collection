import {describe, expect, it} from "vitest";

import {countryCodeToFlagEmoji, logoSrc, photoLoading, PRIORITY_IMAGE_COUNT} from "./model-display.ts";

describe("countryCodeToFlagEmoji", () => {
    it("maps an ISO 3166 alpha-2 code to its flag, case-insensitively", () => {
        expect(countryCodeToFlagEmoji("FI")).toBe("🇫🇮");
        expect(countryCodeToFlagEmoji("fr")).toBe("🇫🇷");
    });
});

describe("logoSrc", () => {
    it("URL-encodes filenames with spaces", () => {
        expect(logoSrc("/brands/Aston Martin.svg")).toBe("/brands/Aston%20Martin.svg");
    });

    it("returns null when there is no logo", () => {
        expect(logoSrc(null)).toBeNull();
    });
});

describe("photoLoading", () => {
    it("loads the first row's photos eagerly at high priority and the rest lazily", () => {
        expect(photoLoading(true)).toEqual({loading: "eager", fetchPriority: "high"});
        expect(photoLoading(false)).toEqual({loading: "lazy", fetchPriority: "auto"});
        expect(PRIORITY_IMAGE_COUNT).toBeGreaterThan(0);
    });
});
