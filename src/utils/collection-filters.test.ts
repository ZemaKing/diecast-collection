// Characterization tests: they pin down how filtering behaves *today* against the real
// car dataset, so the Supabase migration and the Phase 9 query module can prove parity.
// If a number here changes because models were added, update it deliberately.
import {describe, expect, it} from "vitest";

import carModelsData from "../data/car-models.json";
import type {DiecastModel} from "../types.ts";
import {
    ALL_VALUE,
    DEFAULT_FILTERS,
    filterModels,
    findModelById,
    getFilterOptions,
    getModelColors,
    matchesFilters,
    uniqSorted,
    type Filters,
} from "./collection-filters.ts";

const cars = carModelsData as DiecastModel[];

const withFilters = (partial: Partial<Filters>): Filters => ({...DEFAULT_FILTERS, ...partial});
const count = (partial: Partial<Filters>) => filterModels(cars, withFilters(partial)).length;

describe("dataset baseline", () => {
    it("has 227 cars with unique ids", () => {
        expect(cars).toHaveLength(227);
        expect(new Set(cars.map((m) => m.id)).size).toBe(227);
    });
});

describe("uniqSorted", () => {
    it("dedupes and sorts with localeCompare (case- and accent-aware, not code-point order)", () => {
        expect(uniqSorted(["b", "a", "b", "C"])).toEqual(["a", "b", "C"]);
        expect(uniqSorted(["iScale", "Ixo", "Herpa"])).toEqual(["Herpa", "iScale", "Ixo"]);
        expect(uniqSorted(["Subaru", "Škoda", "Seat"])).toEqual(["Seat", "Škoda", "Subaru"]);
    });

    it("returns an empty array for no input", () => {
        expect(uniqSorted([])).toEqual([]);
    });
});

describe("getFilterOptions", () => {
    const options = getFilterOptions(cars);

    it("lists every manufacturer once, sorted", () => {
        expect(options.manufacturers).toEqual([
            "Altaya", "Atlas", "Burago", "DeAgostini", "DTM", "EBBRO", "Edicola", "Fischer", "Herpa",
            "iScale", "Ixo", "Leo Models", "Maisto", "Minichamps", "Onyx", "Schuco", "Solido", "Spark", "Vitesse",
        ]);
    });

    it("lists 46 brands, with accented brands placed by locale", () => {
        expect(options.brands).toHaveLength(46);
        expect(options.brands.slice(0, 3)).toEqual(["Abarth", "Acura", "Alpine"]);
        expect(options.brands.indexOf("Citroën")).toBe(options.brands.indexOf("Chrysler") + 1);
        expect(options.brands.indexOf("Škoda")).toBe(options.brands.indexOf("Seat") + 1);
    });

    it("lists the 5 categories actually present in the data", () => {
        expect(options.categories).toEqual(["Premium", "Racing", "Rally", "Retro", "Supercar"]);
    });

    it("flattens multi-color models into the color list, including the MULTI pseudo-color", () => {
        expect(options.colors).toEqual([
            "Black", "Blue", "Gold", "Gray", "Green", "MULTI", "Orange",
            "Pink", "Purple", "Red", "Silver", "White", "Yellow",
        ]);
    });
});

describe("filterModels on the real dataset", () => {
    it("returns everything with default ('All') filters", () => {
        expect(filterModels(cars, DEFAULT_FILTERS)).toHaveLength(227);
    });

    it.each([
        [{manufacturer: "Altaya"}, 130],
        [{manufacturer: "Ixo"}, 29],
        [{brand: "Ford"}, 22],
        [{category: "Rally"}, 98],
        [{category: "Racing"}, 84],
        [{category: "Supercar"}, 19],
        [{category: "Premium"}, 18],
        [{category: "Retro"}, 8],
        [{color: "White"}, 54],
        [{color: "MULTI"}, 26],
        [{color: "Silver"}, 1],
    ] as [Partial<Filters>, number][])("single filter %o → %i models", (filters, expected) => {
        expect(count(filters)).toBe(expected);
    });

    it("combines filters with AND", () => {
        expect(count({manufacturer: "Altaya", category: "Rally"})).toBe(75);
        expect(count({brand: "Ford", category: "Rally"})).toBe(17);
        expect(count({manufacturer: "Ixo", color: "Red"})).toBe(4);
        expect(count({category: "Racing", color: "MULTI"})).toBe(14);
    });

    it("preserves the source order of the models", () => {
        const ids = filterModels(cars, withFilters({manufacturer: "Ixo"})).map((m) => m.id);
        const sourceOrder = cars.filter((m) => m.manufacturer === "Ixo").map((m) => m.id);
        expect(ids).toEqual(sourceOrder);
    });

    it("matches exactly: case-sensitive, accent-sensitive, no partial matches", () => {
        expect(count({brand: "ford"})).toBe(0);
        expect(count({brand: "Citroen"})).toBe(0);
        expect(count({brand: "Citroën"})).toBeGreaterThan(0);
        expect(count({manufacturer: "Alt"})).toBe(0);
    });

    it("returns nothing for an unknown value instead of ignoring the filter", () => {
        expect(count({category: "Truck"})).toBe(0);
    });
});

describe("matchesFilters color handling", () => {
    const multiColor = findModelById(cars, "acura-integra-gsr-1996-altaya-red")!;

    it("matches a model on any of its colors, not only the first", () => {
        expect(multiColor.color).toEqual(["Red", "Yellow", "White"]);
        for (const color of ["Red", "Yellow", "White"]) {
            expect(matchesFilters(multiColor, withFilters({color}))).toBe(true);
        }
        expect(matchesFilters(multiColor, withFilters({color: "Blue"}))).toBe(false);
    });

    it("filters on `color` names, never on `hex` values", () => {
        expect(matchesFilters(multiColor, withFilters({color: multiColor.hex![0]}))).toBe(false);
    });

    it("tolerates a bare string color from untyped JSON", () => {
        const legacy = {...multiColor, color: "Green"} as unknown as DiecastModel;
        expect(getModelColors(legacy)).toEqual(["Green"]);
        expect(matchesFilters(legacy, withFilters({color: "Green"}))).toBe(true);
    });

    it("treats the literal 'All' as no filter", () => {
        expect(ALL_VALUE).toBe("All");
        expect(matchesFilters(multiColor, withFilters({color: ALL_VALUE}))).toBe(true);
    });
});

describe("findModelById", () => {
    it("finds by exact id and returns undefined otherwise", () => {
        expect(findModelById(cars, "acura-integra-gsr-1996-altaya-red")?.name).toBeDefined();
        expect(findModelById(cars, "does-not-exist")).toBeUndefined();
        expect(findModelById(cars, "ACURA-INTEGRA-GSR-1996-ALTAYA-RED")).toBeUndefined();
    });
});
