import {describe, expect, it} from "vitest";

import {describeResults, heroSubtitle, pluralizeModels} from "./collection-summary.ts";

describe("pluralizeModels", () => {
    it.each([[0, "models"], [1, "model"], [2, "models"], [227, "models"]] as const)("%i → %s", (n, expected) => {
        expect(pluralizeModels(n)).toBe(expected);
    });
});

describe("heroSubtitle", () => {
    it("names the scale when the whole collection shares one", () => {
        expect(heroSubtitle(["1:43"])).toBe("A personal collection of 1:43 scale models");
    });

    it("falls back to scale-agnostic wording for several scales or none", () => {
        expect(heroSubtitle(["1:18", "1:43"])).toBe("A personal collection of diecast scale models");
        expect(heroSubtitle([])).toBe("A personal collection of diecast scale models");
    });
});

describe("describeResults", () => {
    it("shows just the total when nothing narrows the list", () => {
        expect(describeResults({visible: 227, total: 227, activeFilterCount: 0, query: ""}))
            .toEqual({count: "227 models", detail: null, isNarrowed: false});
    });

    it("treats a whitespace-only query as no query", () => {
        expect(describeResults({visible: 227, total: 227, activeFilterCount: 0, query: "   "}).isNarrowed).toBe(false);
    });

    it("shows N of M plus the active filter count", () => {
        expect(describeResults({visible: 29, total: 227, activeFilterCount: 1, query: ""}))
            .toEqual({count: "29 of 227 models", detail: "1 filter", isNarrowed: true});
        expect(describeResults({visible: 5, total: 227, activeFilterCount: 2, query: ""}).detail).toBe("2 filters");
    });

    it("combines search and filters, trimming the query", () => {
        expect(describeResults({visible: 20, total: 227, activeFilterCount: 3, query: "  ford "}))
            .toEqual({count: "20 of 227 models", detail: 'matching "ford" · 3 filters', isNarrowed: true});
    });

    it("still reports zero results as narrowed", () => {
        expect(describeResults({visible: 0, total: 227, activeFilterCount: 0, query: "zzz"}))
            .toEqual({count: "0 of 227 models", detail: 'matching "zzz"', isNarrowed: true});
    });

    it("uses singular for a one-model collection", () => {
        expect(describeResults({visible: 1, total: 1, activeFilterCount: 0, query: ""}).count).toBe("1 model");
    });
});
