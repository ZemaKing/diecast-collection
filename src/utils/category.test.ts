import {describe, expect, it} from "vitest";

import {categoryColorVar, categorySlug} from "./category.ts";

describe("categorySlug", () => {
    it.each([
        ["Rally", "rally"],
        ["Supercar", "supercar"],
        ["Off-Road", "off-road"],
        ["Grand Touring", "grand-touring"],
        ["  Rétro  ", "retro"],
        ["GT/Le Mans", "gt-le-mans"],
    ])("%s → %s", (input, expected) => {
        expect(categorySlug(input)).toBe(expected);
    });
});

describe("categoryColorVar", () => {
    it("points at the slug token with a neutral fallback", () => {
        expect(categoryColorVar("Off-Road")).toBe("var(--cat-off-road, var(--cat-fallback))");
    });
});
