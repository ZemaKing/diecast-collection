import {describe, expect, it} from "vitest";

import {countryCodeToFlagEmoji, logoSrc, modelLinkLabel, photoLoading, PRIORITY_IMAGE_COUNT} from "./model-display.ts";

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

describe("modelLinkLabel", () => {
    const racing = {
        name: "Aston Martin V12 Vantage GT3",
        year: 2013,
        scale: "1:43",
        carNumber: "50",
        brand: {name: "Aston Martin"},
        manufacturer: {name: "EBBRO"},
        category: {name: "Racing"},
        driver: {name: "Masaki Kano"},
    };

    it("starts with the model name, then the facts once each", () => {
        expect(modelLinkLabel(racing)).toBe("Aston Martin V12 Vantage GT3, 2013, Aston Martin, EBBRO, Racing, #50, Masaki Kano, 1:43");
    });

    it("leaves out what a model doesn't have", () => {
        expect(modelLinkLabel({...racing, carNumber: null, driver: null, category: {name: "Retro"}}))
            .toBe("Aston Martin V12 Vantage GT3, 2013, Aston Martin, EBBRO, Retro, 1:43");
    });

    it("skips an unset year (the admin form's live preview)", () => {
        expect(modelLinkLabel({...racing, year: 0, carNumber: null, driver: null})).toBe("Aston Martin V12 Vantage GT3, Aston Martin, EBBRO, Racing, 1:43");
    });
});
