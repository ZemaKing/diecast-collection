import {describe, expect, it} from "vitest";

import {buildModelSummaryFixtures} from "./fixtures.test-data.ts";
import {getCollectionStats} from "./stats.ts";

describe("getCollectionStats", () => {
    it("matches the known dataset totals (227 models, 45 brands, 19 manufacturers, 5 categories)", () => {
        const stats = getCollectionStats(buildModelSummaryFixtures());
        expect(stats).toEqual({
            totalModels: 227,
            totalBrands: 45,
            totalManufacturers: 19,
            totalCategories: 5,
        });
    });

    it("returns zeroes for an empty collection", () => {
        expect(getCollectionStats([])).toEqual({totalModels: 0, totalBrands: 0, totalManufacturers: 0, totalCategories: 0});
    });
});
