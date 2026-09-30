import {describe, expect, it} from "vitest";

import {describeCategories, formatRelated, formatYears} from "./browse-display.ts";

describe("browse display copy", () => {
    it("formats a year range, collapsing a single year", () => {
        expect(formatYears({from: 1965, to: 2020})).toBe("1965–2020");
        expect(formatYears({from: 2016, to: 2016})).toBe("2016");
    });

    it("names the other dimension, singular or plural", () => {
        expect(formatRelated("manufacturers", 34)).toBe("34 brands");
        expect(formatRelated("manufacturers", 1)).toBe("1 brand");
        expect(formatRelated("brands", 3)).toBe("3 manufacturers");
        expect(formatRelated("brands", 1)).toBe("1 manufacturer");
    });

    it("describes the category mix as text", () => {
        expect(describeCategories([{slug: "racing", name: "Racing", count: 60}, {slug: "rally", name: "Rally", count: 40}])).toBe("Racing 60, Rally 40");
        expect(describeCategories([])).toBe("");
    });
});
