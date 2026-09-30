import {describe, expect, it} from "vitest";

import {countryCodeToFlagEmoji, logoSrc} from "./model-display.ts";

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
