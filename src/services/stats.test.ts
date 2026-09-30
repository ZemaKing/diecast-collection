import {describe, expect, it} from "vitest";

import {buildModelSummaryFixtures} from "./fixtures.test-data.ts";
import {getCollectionStats} from "./stats.ts";

describe("getCollectionStats", () => {
    it("matches the known dataset totals (227 models, 45 brands, 19 manufacturers, 5 categories, one 1:43 scale)", () => {
        const stats = getCollectionStats(buildModelSummaryFixtures());
        expect(stats).toEqual({
            totalModels: 227,
            totalBrands: 45,
            totalManufacturers: 19,
            totalCategories: 5,
            scales: ["1:43"],
        });
    });

    it("lists each distinct scale once, sorted", () => {
        const [a, b, c] = buildModelSummaryFixtures();
        const stats = getCollectionStats([{...a!, scale: "1:18"}, {...b!, scale: "1:43"}, {...c!, scale: "1:18"}]);
        expect(stats.scales).toEqual(["1:18", "1:43"]);
    });

    it("returns zeroes for an empty collection", () => {
        expect(getCollectionStats([])).toEqual({totalModels: 0, totalBrands: 0, totalManufacturers: 0, totalCategories: 0, scales: []});
    });
});
