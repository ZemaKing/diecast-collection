import {describe, expect, it} from "vitest";

import {getBrowseEntries, getBrowseEntry, getBrowseModels, sortBrowseEntries} from "./browse.ts";
import {EMPTY_FILTERS, getFacetCounts} from "./collection-query.ts";
import {buildModelSummaryFixtures} from "./fixtures.test-data.ts";

// Characterization tests against the real car-models.json (via the fixtures) — adding a car
// changes some of these counts; update them deliberately.
const models = buildModelSummaryFixtures();

describe("getBrowseEntries", () => {
    it("has one entry per manufacturer/brand in the collection (19 / 45), A–Z", () => {
        const manufacturers = getBrowseEntries(models, "manufacturers");
        const brands = getBrowseEntries(models, "brands");
        expect(manufacturers).toHaveLength(19);
        expect(brands).toHaveLength(45);
        const names = brands.map((b) => b.name);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it("matches the ROADMAP verification counts: Altaya 130, Ixo 29, Ford 22", () => {
        const bySlug = (kind: "brands" | "manufacturers") => new Map(getBrowseEntries(models, kind).map((e) => [e.slug, e.count]));
        expect(bySlug("manufacturers").get("altaya")).toBe(130);
        expect(bySlug("manufacturers").get("ixo")).toBe(29);
        expect(bySlug("brands").get("ford")).toBe(22);
    });

    it("gives every entry the same count the filter panel shows (unfiltered facets)", () => {
        const facets = getFacetCounts(models, EMPTY_FILTERS);
        for (const kind of ["brands", "manufacturers"] as const) {
            const counts = getBrowseEntries(models, kind).map(({slug, name, count}) => ({slug, name, count}));
            expect(counts).toEqual(facets[kind]);
        }
    });

    it("counts add up to the whole collection, and each entry's categories add up to its count", () => {
        for (const kind of ["brands", "manufacturers"] as const) {
            const entries = getBrowseEntries(models, kind);
            expect(entries.reduce((n, e) => n + e.count, 0)).toBe(models.length);
            for (const entry of entries) {
                expect(entry.categories.reduce((n, c) => n + c.count, 0)).toBe(entry.count);
            }
        }
    });

    it("orders an entry's categories by count, most first", () => {
        const altaya = getBrowseEntry(models, "manufacturers", "altaya")!;
        const counts = altaya.categories.map((c) => c.count);
        expect(counts).toEqual([...counts].sort((a, b) => b - a));
    });

    it("returns nothing for an empty collection", () => {
        expect(getBrowseEntries([], "brands")).toEqual([]);
    });
});

describe("getBrowseEntry", () => {
    it("describes one brand/manufacturer: count, year range, related count", () => {
        const [a, b, c] = models;
        const fixture = [
            {...a!, year: 1990, brand: {slug: "x", name: "X", logoPath: "/brands/X.svg"}, manufacturer: {slug: "m1", name: "M1", logoPath: null}},
            {...b!, year: 2010, brand: {slug: "x", name: "X", logoPath: "/brands/X.svg"}, manufacturer: {slug: "m2", name: "M2", logoPath: null}},
            {...c!, year: 1970, brand: {slug: "y", name: "Y", logoPath: null}, manufacturer: {slug: "m1", name: "M1", logoPath: null}},
        ];
        expect(getBrowseEntry(fixture, "brands", "x")).toMatchObject({
            slug: "x", name: "X", logoPath: "/brands/X.svg", count: 2, years: {from: 1990, to: 2010}, relatedCount: 2,
        });
        expect(getBrowseEntry(fixture, "manufacturers", "m1")).toMatchObject({count: 2, years: {from: 1970, to: 1990}, relatedCount: 2});
    });

    it("is null for an unknown slug (→ 404)", () => {
        expect(getBrowseEntry(models, "brands", "not-a-brand")).toBeNull();
        expect(getBrowseEntry(models, "manufacturers", "")).toBeNull();
    });

    it("resolves brands whose names have accents or spaces by their slug", () => {
        expect(getBrowseEntry(models, "brands", "citroen")?.name).toBe("Citroën");
        expect(getBrowseEntry(models, "brands", "aston-martin")?.name).toBe("Aston Martin");
    });
});

describe("getBrowseModels", () => {
    it("is exactly the collection's ?manufacturer= filter", () => {
        const ixo = getBrowseModels(models, "manufacturers", "ixo");
        expect(ixo).toHaveLength(29);
        expect(ixo.every((m) => m.manufacturer.slug === "ixo")).toBe(true);
    });
});

describe("sortBrowseEntries", () => {
    const entries = getBrowseEntries(models, "manufacturers");

    it("count: most models first, ties A–Z", () => {
        const sorted = sortBrowseEntries(entries, "count");
        expect(sorted[0]!.slug).toBe("altaya");
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1]!;
            const cur = sorted[i]!;
            expect(prev.count > cur.count || (prev.count === cur.count && prev.name.localeCompare(cur.name) <= 0)).toBe(true);
        }
    });

    it("name: A–Z, without mutating the input", () => {
        const reversed = [...entries].reverse();
        const copy = [...reversed];
        expect(sortBrowseEntries(reversed, "name").map((e) => e.slug)).toEqual(entries.map((e) => e.slug));
        expect(reversed).toEqual(copy);
    });
});
