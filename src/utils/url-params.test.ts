import {describe, expect, it} from "vitest";

import {DEFAULT_FILTERS} from "./collection-filters.ts";
import {
    applyFiltersToSearchParams,
    filtersEqual,
    getFiltersFromSearchParams,
    withModelParam,
    withoutModelParam,
} from "./url-params.ts";

const params = (query: string) => new URLSearchParams(query);

describe("getFiltersFromSearchParams", () => {
    it("defaults every missing filter to 'All'", () => {
        expect(getFiltersFromSearchParams(params(""))).toEqual(DEFAULT_FILTERS);
    });

    it("reads display-name values verbatim (including accents and spaces)", () => {
        expect(getFiltersFromSearchParams(params("brand=Citro%C3%ABn&manufacturer=Leo+Models"))).toEqual({
            ...DEFAULT_FILTERS,
            brand: "Citroën",
            manufacturer: "Leo Models",
        });
    });

    it("treats an empty value as 'All'", () => {
        expect(getFiltersFromSearchParams(params("brand=&color=Red"))).toEqual({...DEFAULT_FILTERS, color: "Red"});
    });

    it("uses only the first value of a repeated param (single-value filters)", () => {
        expect(getFiltersFromSearchParams(params("color=Red&color=Blue")).color).toBe("Red");
    });

    it("ignores unrelated params", () => {
        expect(getFiltersFromSearchParams(params("model=x&foo=bar"))).toEqual(DEFAULT_FILTERS);
    });
});

describe("applyFiltersToSearchParams", () => {
    it("sets non-'All' filters and removes 'All' ones", () => {
        const next = applyFiltersToSearchParams(params("brand=Ford&color=Red"), {
            ...DEFAULT_FILTERS,
            manufacturer: "Ixo",
            color: "Red",
        });
        expect(next.get("brand")).toBeNull();
        expect(next.get("manufacturer")).toBe("Ixo");
        expect(next.get("color")).toBe("Red");
    });

    it("never clobbers non-filter params such as ?model=", () => {
        const next = applyFiltersToSearchParams(params("model=abc&foo=1"), {...DEFAULT_FILTERS, brand: "Ford"});
        expect(next.get("model")).toBe("abc");
        expect(next.get("foo")).toBe("1");
    });

    it("does not mutate its input", () => {
        const input = params("brand=Ford");
        applyFiltersToSearchParams(input, DEFAULT_FILTERS);
        expect(input.toString()).toBe("brand=Ford");
    });

    it("round-trips through getFiltersFromSearchParams", () => {
        const filters = {brand: "Škoda", manufacturer: "Altaya", category: "Rally", color: "MULTI"};
        expect(getFiltersFromSearchParams(applyFiltersToSearchParams(params(""), filters))).toEqual(filters);
    });

    it("is a no-op string-wise when the URL already reflects the filters (prevents effect loops)", () => {
        const current = params("model=abc&brand=Ford");
        const next = applyFiltersToSearchParams(current, getFiltersFromSearchParams(current));
        expect(next.toString()).toBe(current.toString());
    });
});

describe("filtersEqual", () => {
    it("compares all four filter keys", () => {
        expect(filtersEqual(DEFAULT_FILTERS, {...DEFAULT_FILTERS})).toBe(true);
        expect(filtersEqual(DEFAULT_FILTERS, {...DEFAULT_FILTERS, color: "Red"})).toBe(false);
    });
});

describe("model param", () => {
    it("adds ?model= while keeping filters", () => {
        const next = withModelParam(params("brand=Ford"), "ford-escort");
        expect(next.toString()).toBe("brand=Ford&model=ford-escort");
    });

    it("replaces an existing model id", () => {
        expect(withModelParam(params("model=a"), "b").getAll("model")).toEqual(["b"]);
    });

    it("removes ?model= while keeping filters", () => {
        expect(withoutModelParam(params("brand=Ford&model=x&color=Red")).toString()).toBe("brand=Ford&color=Red");
    });

    it("does not mutate its input", () => {
        const input = params("model=x");
        withoutModelParam(input);
        withModelParam(input, "y");
        expect(input.toString()).toBe("model=x");
    });
});
