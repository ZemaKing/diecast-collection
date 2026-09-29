import {describe, expect, it} from "vitest";

import {EMPTY_FILTERS} from "../services/collection-query.ts";
import {
    applyCollectionFiltersToSearchParams,
    getCollectionFiltersFromSearchParams,
    withModelParam,
    withoutModelParam,
} from "./url-params.ts";

const params = (query: string) => new URLSearchParams(query);

describe("getCollectionFiltersFromSearchParams", () => {
    it("defaults every missing filter to an empty array", () => {
        expect(getCollectionFiltersFromSearchParams(params(""))).toEqual(EMPTY_FILTERS);
    });

    it("reads repeated params as a multi-value filter, slugified", () => {
        expect(getCollectionFiltersFromSearchParams(params("brand=ford&brand=bmw")).brands).toEqual(["ford", "bmw"]);
    });

    it("parses legacy single-value display-name URLs (pre-Phase-13 shared links)", () => {
        expect(getCollectionFiltersFromSearchParams(params("brand=Citro%C3%ABn")).brands).toEqual(["citroen"]);
        expect(getCollectionFiltersFromSearchParams(params("manufacturer=Leo+Models")).manufacturers).toEqual(["leo-models"]);
        expect(getCollectionFiltersFromSearchParams(params("color=MULTI")).colors).toEqual(["multi"]);
    });

    it("dedupes values that normalize to the same slug", () => {
        expect(getCollectionFiltersFromSearchParams(params("color=Red&color=red&color=RED")).colors).toEqual(["red"]);
    });

    it("treats an empty value as absent, not as a filter", () => {
        expect(getCollectionFiltersFromSearchParams(params("brand=&color=Red")).brands).toEqual([]);
        expect(getCollectionFiltersFromSearchParams(params("brand=&color=Red")).colors).toEqual(["red"]);
    });

    it("keeps unknown slugs rather than silently dropping them (filterModels just won't match)", () => {
        expect(getCollectionFiltersFromSearchParams(params("brand=not-a-real-brand")).brands).toEqual(["not-a-real-brand"]);
    });

    it("ignores unrelated params", () => {
        expect(getCollectionFiltersFromSearchParams(params("model=x&foo=bar"))).toEqual(EMPTY_FILTERS);
    });
});

describe("applyCollectionFiltersToSearchParams", () => {
    it("writes each value as its own repeated param, sorted", () => {
        const next = applyCollectionFiltersToSearchParams(params(""), {...EMPTY_FILTERS, brands: ["bmw", "ford"]});
        expect(next.getAll("brand")).toEqual(["bmw", "ford"]);
    });

    it("removes a filter key entirely when its array is empty", () => {
        const next = applyCollectionFiltersToSearchParams(params("brand=ford"), EMPTY_FILTERS);
        expect(next.has("brand")).toBe(false);
    });

    it("never clobbers non-filter params such as ?model=", () => {
        const next = applyCollectionFiltersToSearchParams(params("model=abc&foo=1"), {...EMPTY_FILTERS, brands: ["ford"]});
        expect(next.get("model")).toBe("abc");
        expect(next.get("foo")).toBe("1");
    });

    it("does not mutate its input", () => {
        const input = params("brand=ford");
        applyCollectionFiltersToSearchParams(input, EMPTY_FILTERS);
        expect(input.toString()).toBe("brand=ford");
    });

    it("dedupes and writes canonical slugs even from legacy input", () => {
        const next = applyCollectionFiltersToSearchParams(params(""), {...EMPTY_FILTERS, colors: ["MULTI", "multi"]});
        expect(next.getAll("color")).toEqual(["multi"]);
    });

    it("round-trips through getCollectionFiltersFromSearchParams", () => {
        const filters = {brands: ["bmw", "ford"], manufacturers: ["altaya"], categories: ["rally"], colors: ["multi"]};
        expect(getCollectionFiltersFromSearchParams(applyCollectionFiltersToSearchParams(params(""), filters))).toEqual(filters);
    });

    it("is a no-op string-wise when the URL already reflects the filters (prevents effect loops)", () => {
        const current = params("brand=bmw&brand=ford&model=abc");
        const next = applyCollectionFiltersToSearchParams(current, getCollectionFiltersFromSearchParams(current));
        expect(next.toString()).toBe(current.toString());
    });
});

describe("model param", () => {
    it("adds ?model= while keeping filters", () => {
        const next = withModelParam(params("brand=ford"), "ford-escort");
        expect(next.toString()).toBe("brand=ford&model=ford-escort");
    });

    it("replaces an existing model id", () => {
        expect(withModelParam(params("model=a"), "b").getAll("model")).toEqual(["b"]);
    });

    it("removes ?model= while keeping filters", () => {
        expect(withoutModelParam(params("brand=ford&model=x&color=red")).toString()).toBe("brand=ford&color=red");
    });

    it("does not mutate its input", () => {
        const input = params("model=x");
        withoutModelParam(input);
        withModelParam(input, "y");
        expect(input.toString()).toBe("model=x");
    });
});
