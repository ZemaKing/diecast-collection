import {beforeEach, describe, expect, it, vi} from "vitest";

import {chainable} from "./chainable.test-data.ts";

const from = vi.fn();
vi.mock("../lib/supabase.ts", () => ({supabase: {from: (...args: unknown[]) => from(...args)}}));

const {getBrands, getCategories, getColors, getManufacturers} = await import("./lookups.ts");

describe("lookups", () => {
    beforeEach(() => {
        from.mockReset();
    });

    it("getBrands maps slug/name/logo_path", async () => {
        from.mockReturnValue(chainable({data: [{slug: "abarth", name: "Abarth", logo_path: "/brands/Abarth.svg"}], error: null}));
        await expect(getBrands()).resolves.toEqual([{slug: "abarth", name: "Abarth", logoPath: "/brands/Abarth.svg"}]);
        expect(from).toHaveBeenCalledWith("brands");
    });

    it("getManufacturers maps slug/name/logo_path", async () => {
        from.mockReturnValue(chainable({data: [{slug: "altaya", name: "Altaya", logo_path: null}], error: null}));
        await expect(getManufacturers()).resolves.toEqual([{slug: "altaya", name: "Altaya", logoPath: null}]);
        expect(from).toHaveBeenCalledWith("manufacturers");
    });

    it("getCategories maps sort_order", async () => {
        from.mockReturnValue(chainable({data: [{slug: "rally", name: "Rally", sort_order: 10}], error: null}));
        await expect(getCategories()).resolves.toEqual([{slug: "rally", name: "Rally", sortOrder: 10}]);
        expect(from).toHaveBeenCalledWith("categories");
    });

    it("getColors maps hex", async () => {
        from.mockReturnValue(chainable({data: [{slug: "green", name: "Green", hex: "#2E9E45"}], error: null}));
        await expect(getColors()).resolves.toEqual([{slug: "green", name: "Green", hex: "#2E9E45"}]);
        expect(from).toHaveBeenCalledWith("colors");
    });

    it("throws an AppError when Supabase returns an error", async () => {
        from.mockReturnValue(chainable({data: null, error: {message: "boom", code: "500"}}));
        await expect(getBrands()).rejects.toMatchObject({kind: expect.any(String)});
    });
});
