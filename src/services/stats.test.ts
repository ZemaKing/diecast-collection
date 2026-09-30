import {describe, expect, it} from "vitest";

import {buildModelSummaryFixtures} from "./fixtures.test-data.ts";
import {decadeOf, formatShare, getCollectionBreakdown, getCollectionStats, getDecadeCounts, topEntries} from "./stats.ts";

// Characterization tests against the real car-models.json (via the fixtures) — adding a car
// changes some of these counts; update them deliberately.
const models = buildModelSummaryFixtures();

describe("getCollectionStats", () => {
    it("matches the known dataset totals (227 models, 45 brands, 19 manufacturers, 5 categories, one 1:43 scale)", () => {
        const stats = getCollectionStats(models);
        expect(stats).toEqual({
            totalModels: 227,
            totalBrands: 45,
            totalManufacturers: 19,
            totalCategories: 5,
            scales: ["1:43"],
        });
    });

    it("lists each distinct scale once, sorted", () => {
        const [a, b, c] = models;
        const stats = getCollectionStats([{...a!, scale: "1:18"}, {...b!, scale: "1:43"}, {...c!, scale: "1:18"}]);
        expect(stats.scales).toEqual(["1:18", "1:43"]);
    });

    it("returns zeroes for an empty collection", () => {
        expect(getCollectionStats([])).toEqual({totalModels: 0, totalBrands: 0, totalManufacturers: 0, totalCategories: 0, scales: []});
    });
});

describe("getCollectionBreakdown", () => {
    const breakdown = getCollectionBreakdown(models);

    it("ranks brands and manufacturers by model count", () => {
        expect(breakdown.brands.slice(0, 3).map((e) => [e.name, e.count])).toEqual([["Ford", 22], ["Porsche", 14], ["Ferrari", 13]]);
        expect(breakdown.manufacturers.slice(0, 3).map((e) => [e.name, e.count])).toEqual([["Altaya", 130], ["Ixo", 29], ["Burago", 10]]);
        expect(breakdown.brands).toHaveLength(45);
        expect(breakdown.manufacturers).toHaveLength(19);
    });

    it("lists categories in their sort order, adding up to the collection", () => {
        expect(breakdown.categories.map((c) => [c.slug, c.count])).toEqual([
            ["rally", 98], ["racing", 84], ["supercar", 19], ["premium", 18], ["retro", 8],
        ]);
    });

    it("counts models by decade, 1960s–2020s, adding up to the collection", () => {
        expect(breakdown.decades.map((d) => [d.label, d.count])).toEqual([
            ["1960s", 1], ["1970s", 17], ["1980s", 23], ["1990s", 31], ["2000s", 70], ["2010s", 73], ["2020s", 12],
        ]);
        expect(breakdown.decades.reduce((n, d) => n + d.count, 0)).toBe(227);
    });

    it("splits racing vs road by is_racing (182 / 45)", () => {
        expect(breakdown.racing).toEqual({racing: 182, road: 45});
    });

    it("counts colors like the Color filter — once per livery color, most first", () => {
        expect(breakdown.colors.slice(0, 3).map((c) => [c.slug, c.count])).toEqual([["white", 54], ["red", 33], ["blue", 28]]);
        const counts = breakdown.colors.map((c) => c.count);
        expect(counts).toEqual([...counts].sort((a, b) => b - a));
        // Two-tone liveries count under both colors.
        expect(breakdown.colors.reduce((n, c) => n + c.count, 0)).toBeGreaterThan(227);
    });

    it("updates when a model is added — nothing is hard-coded", () => {
        const [first] = models;
        const added = {...first!, slug: "new-model", year: 1955, isRacing: false, brand: {slug: "new-brand", name: "New Brand", logoPath: null}};
        const next = getCollectionBreakdown([...models, added]);
        expect(next.decades[0]).toEqual({decade: 1950, label: "1950s", count: 1});
        expect(next.racing.road).toBe(46);
        expect(next.brands).toHaveLength(46);
    });

    it("is empty for an empty collection", () => {
        expect(getCollectionBreakdown([])).toEqual({brands: [], manufacturers: [], categories: [], colors: [], decades: [], racing: {racing: 0, road: 0}});
    });
});

describe("getDecadeCounts", () => {
    it("fills empty decades between the oldest and newest model", () => {
        const [a, b] = models;
        const decades = getDecadeCounts([{...a!, year: 1968}, {...b!, year: 1991}]);
        expect(decades.map((d) => [d.label, d.count])).toEqual([["1960s", 1], ["1970s", 0], ["1980s", 0], ["1990s", 1]]);
    });

    it("maps a year to its decade", () => {
        expect(decadeOf(1969)).toBe(1960);
        expect(decadeOf(2020)).toBe(2020);
    });
});

describe("topEntries", () => {
    it("returns everyone tied for the top count", () => {
        expect(topEntries([{id: "a", count: 3}, {id: "b", count: 5}, {id: "c", count: 5}]).map((e) => e.id)).toEqual(["b", "c"]);
        expect(topEntries([])).toEqual([]);
    });
});

describe("formatShare", () => {
    it("rounds to a whole percentage, never shows a non-zero share as 0%", () => {
        expect(formatShare(130, 227)).toBe("57%");
        expect(formatShare(1, 227)).toBe("<1%");
        expect(formatShare(0, 227)).toBe("0%");
        expect(formatShare(1, 0)).toBe("0%");
    });
});
