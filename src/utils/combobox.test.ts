import {describe, expect, it} from "vitest";

import {canCreateOption, filterComboboxOptions, findExactOption, moveActiveIndex} from "./combobox.ts";

const options = [
    {value: "alfa-romeo", label: "Alfa Romeo"},
    {value: "citroen", label: "Citroën"},
    {value: "mercedes-benz", label: "Mercedes-Benz"},
    {value: "romeo-ferraris", label: "Romeo Ferraris"},
    {value: "skoda", label: "Škoda"},
];

describe("filterComboboxOptions", () => {
    it("returns everything for an empty query", () => {
        expect(filterComboboxOptions(options, "  ")).toBe(options);
    });

    it("ignores case and diacritics", () => {
        expect(filterComboboxOptions(options, "CITRO").map((o) => o.value)).toEqual(["citroen"]);
        expect(filterComboboxOptions(options, "skod").map((o) => o.value)).toEqual(["skoda"]);
    });

    it("ranks label starts, then word starts, then anything else", () => {
        expect(filterComboboxOptions(options, "rome").map((o) => o.value)).toEqual(["romeo-ferraris", "alfa-romeo"]);
        expect(filterComboboxOptions(options, "benz").map((o) => o.value)).toEqual(["mercedes-benz"]);
        expect(filterComboboxOptions(options, "eo").map((o) => o.value)).toEqual(["alfa-romeo", "romeo-ferraris"]);
    });
});

describe("findExactOption / canCreateOption", () => {
    it("matches a whole label regardless of case and accents", () => {
        expect(findExactOption(options, " citroen ")?.value).toBe("citroen");
        expect(findExactOption(options, "citro")).toBeUndefined();
    });

    it("offers “Add …” only for new, non-empty text", () => {
        expect(canCreateOption(options, "Škoda")).toBe(false);
        expect(canCreateOption(options, "   ")).toBe(false);
        expect(canCreateOption(options, "Lancia")).toBe(true);
    });
});

describe("moveActiveIndex", () => {
    it("starts at either end and wraps", () => {
        expect(moveActiveIndex(-1, 1, 3)).toBe(0);
        expect(moveActiveIndex(-1, -1, 3)).toBe(2);
        expect(moveActiveIndex(2, 1, 3)).toBe(0);
        expect(moveActiveIndex(0, -1, 3)).toBe(2);
        expect(moveActiveIndex(0, 1, 0)).toBe(-1);
    });
});
