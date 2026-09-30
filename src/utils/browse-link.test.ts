import {describe, expect, it} from "vitest";

import {browseCollectionPath, browseIndexPath, browsePath, getBrowseSortFromSearchParams, withBrowseSort} from "./browse-link.ts";

describe("browse paths", () => {
    it("builds index and detail paths", () => {
        expect(browseIndexPath("manufacturers")).toBe("/manufacturers");
        expect(browsePath("brands", "aston-martin")).toBe("/brands/aston-martin");
        expect(browsePath("brands", "a b")).toBe("/brands/a%20b");
    });

    it("links to the collection filtered to the brand/manufacturer, plus any picked categories", () => {
        expect(browseCollectionPath("brands", "ford")).toBe("/?brand=ford");
        expect(browseCollectionPath("manufacturers", "ixo", ["rally", "racing"])).toBe("/?manufacturer=ixo&category=racing&category=rally");
    });
});

describe("index order param", () => {
    it("defaults to count; only name is recognised", () => {
        expect(getBrowseSortFromSearchParams(new URLSearchParams())).toBe("count");
        expect(getBrowseSortFromSearchParams(new URLSearchParams("order=name"))).toBe("name");
        expect(getBrowseSortFromSearchParams(new URLSearchParams("order=bogus"))).toBe("count");
    });

    it("writes ?order=name, omits the default, keeps other params, never mutates", () => {
        const input = new URLSearchParams("x=1");
        expect(withBrowseSort(input, "name").toString()).toBe("x=1&order=name");
        expect(withBrowseSort(new URLSearchParams("order=name&x=1"), "count").toString()).toBe("x=1");
        expect(input.toString()).toBe("x=1");
    });
});
