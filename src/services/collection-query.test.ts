import {describe, expect, it} from "vitest";

import {buildModelSummaryFixtures} from "./fixtures.test-data.ts";
import {
    EMPTY_FILTERS,
    filterModels,
    getFacetCounts,
    normalizeSearchText,
    searchModels,
    sortModels,
} from "./collection-query.ts";

const models = buildModelSummaryFixtures();

describe("filterModels", () => {
    it("returns everything with no active filters", () => {
        expect(filterModels(models, EMPTY_FILTERS)).toHaveLength(models.length);
    });

    // Characterization: known counts against the real car-models.json (ROADMAP Phase 14/22 notes).
    it("filters by manufacturer", () => {
        expect(filterModels(models, {...EMPTY_FILTERS, manufacturers: ["ixo"]})).toHaveLength(29);
        expect(filterModels(models, {...EMPTY_FILTERS, manufacturers: ["altaya"]})).toHaveLength(130);
    });

    it("filters by brand", () => {
        expect(filterModels(models, {...EMPTY_FILTERS, brands: ["ford"]})).toHaveLength(22);
    });

    it("filters by category", () => {
        expect(filterModels(models, {...EMPTY_FILTERS, categories: ["rally"]})).toHaveLength(98);
    });

    it("OR's multiple values within one field", () => {
        const rallyOrRacing = filterModels(models, {...EMPTY_FILTERS, categories: ["rally", "racing"]});
        const rally = filterModels(models, {...EMPTY_FILTERS, categories: ["rally"]});
        const racing = filterModels(models, {...EMPTY_FILTERS, categories: ["racing"]});
        expect(rallyOrRacing).toHaveLength(rally.length + racing.length);
    });

    it("AND's across fields", () => {
        const fordRally = filterModels(models, {...EMPTY_FILTERS, brands: ["ford"], categories: ["rally"]});
        expect(fordRally.length).toBeGreaterThan(0);
        expect(fordRally.every((m) => m.brand.slug === "ford" && m.category.slug === "rally")).toBe(true);
    });

    it("matches a multi-color model on any of its colors", () => {
        const multi = models.find((m) => m.colors.length > 1);
        expect(multi).toBeDefined();
        const bySecondColor = filterModels(models, {...EMPTY_FILTERS, colors: [multi!.colors[1]!.slug]});
        expect(bySecondColor.some((m) => m.slug === multi!.slug)).toBe(true);
    });
});

describe("normalizeSearchText", () => {
    it("strips diacritics and lowercases", () => {
        expect(normalizeSearchText("Citroën")).toBe("citroen");
        expect(normalizeSearchText("Škoda")).toBe("skoda");
    });
});

describe("searchModels", () => {
    it("returns everything for an empty (or whitespace) query", () => {
        expect(searchModels(models, "")).toHaveLength(models.length);
        expect(searchModels(models, "   ")).toHaveLength(models.length);
    });

    it("is diacritic- and case-insensitive on brand", () => {
        const results = searchModels(models, "CITROEN");
        expect(results.length).toBeGreaterThan(0);
        expect(results.every((m) => normalizeSearchText(m.brand.name).includes("citroen"))).toBe(true);
    });

    it("matches by year", () => {
        const results = searchModels(models, "2017");
        expect(results.length).toBeGreaterThan(0);
        expect(results.every((m) => String(m.year).includes("2017"))).toBe(true);
    });

    it("matches nothing that doesn't contain the query anywhere", () => {
        expect(searchModels(models, "zzz-not-a-real-model-zzz")).toHaveLength(0);
    });
});

describe("sortModels", () => {
    it("sorts name-asc with a stable slug tie-breaker", () => {
        const sorted = sortModels(models, "name-asc");
        for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i - 1]!.name.localeCompare(sorted[i]!.name)).toBeLessThanOrEqual(0);
        }
    });

    it("sorts year-desc", () => {
        const sorted = sortModels(models, "year-desc");
        for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i - 1]!.year).toBeGreaterThanOrEqual(sorted[i]!.year);
        }
    });

    it("never mutates the input array", () => {
        const copy = [...models];
        sortModels(models, "name-desc");
        expect(models).toEqual(copy);
    });

    it("sorts NULL added_at last regardless of direction", () => {
        const withDates = models.slice(0, 5).map((m, i) => ({...m, addedAt: `2026-0${i + 1}-01`}));
        const withoutDates = models.slice(5, 8).map((m) => ({...m, addedAt: null}));
        const mixed = [...withoutDates, ...withDates];

        expect(sortModels(mixed, "added-desc").slice(-3).every((m) => m.addedAt === null)).toBe(true);
        expect(sortModels(mixed, "added-asc").slice(-3).every((m) => m.addedAt === null)).toBe(true);
    });
});

describe("getFacetCounts", () => {
    it("counts a facet against the OTHER active filters, but not its own", () => {
        const counts = getFacetCounts(models, {...EMPTY_FILTERS, brands: ["ford"]});

        // categories/manufacturers/colors are narrowed by the brand filter...
        const fordModelCount = filterModels(models, {...EMPTY_FILTERS, brands: ["ford"]}).length;
        expect(counts.categories.reduce((n, c) => n + c.count, 0)).toBe(fordModelCount);

        // ...but the brand facet itself ignores the brand filter (reflects everyone else).
        expect(counts.brands.reduce((n, b) => n + b.count, 0)).toBe(models.length);
    });

    it("matches the known Rally category count with no filters active", () => {
        const counts = getFacetCounts(models, EMPTY_FILTERS);
        expect(counts.categories.find((c) => c.slug === "rally")?.count).toBe(98);
    });
});
