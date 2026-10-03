import {beforeEach, describe, expect, it, vi} from "vitest";

import {chainable} from "./chainable.test-data.ts";

const from = vi.fn();
vi.mock("../lib/supabase.ts", () => ({supabase: {from: (...args: unknown[]) => from(...args)}}));

const {getDraftModels, getModelBySlug, getModels, getRecentlyAddedModels} = await import("./models.ts");
const {SUMMARY_COLUMNS} = await import("./mappers.ts");

const summaryRow = {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "abarth-124-rally-rgt-2017-altaya-green",
    name: "Abarth 124 Rally RGT",
    year: 2017,
    scale: "1:43",
    is_racing: true,
    car_number: "27",
    livery_hex: ["#469F18"],
    team: null,
    event: null,
    series: null,
    condition: null,
    location: null,
    added_at: null,
    is_published: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    brand_slug: "abarth",
    brand_name: "Abarth",
    brand_logo_path: "/brands/Abarth.svg",
    manufacturer_slug: "altaya",
    manufacturer_name: "Altaya",
    manufacturer_logo_path: "/manufacturers/Altaya.svg",
    category_slug: "rally",
    category_name: "Rally",
    category_sort_order: 10,
    driver_slug: "gabriele-noberasco",
    driver_name: "Gabriele Noberasco",
    driver_country_code: null,
    color_slugs: ["green"],
    color_names: ["Green"],
    image_storage_path: null,
    image_external_url: "https://i.postimg.cc/Twq7K6pg/abarth.png",
    thumb_storage_path: null,
    thumb_external_url: "https://i.postimg.cc/BQgjMw17/abarth-thumb.png",
    image_width: null,
    image_height: null,
    image_count: 1,
};

describe("getModels / getRecentlyAddedModels", () => {
    beforeEach(() => {
        from.mockReset();
    });

    it("public reads ask for published models explicitly — an admin's RLS would also return drafts", async () => {
        const published = chainable({data: [summaryRow], error: null});
        from.mockReturnValue(published);
        await getModels();
        expect(published.calls).toContainEqual(["eq", ["is_published", true]]);

        const recent = chainable({data: [summaryRow], error: null});
        from.mockReturnValue(recent);
        await getRecentlyAddedModels();
        expect(recent.calls).toContainEqual(["eq", ["is_published", true]]);
    });

    it("getDraftModels asks for unpublished models only", async () => {
        const drafts = chainable({data: [{...summaryRow, is_published: false}], error: null});
        from.mockReturnValue(drafts);
        const models = await getDraftModels();
        expect(from).toHaveBeenCalledWith("model_summaries");
        expect(drafts.calls).toContainEqual(["eq", ["is_published", false]]);
        expect(models).toHaveLength(1);
    });

    it("getModels reads model_summaries and maps every row", async () => {
        const query = chainable({data: [summaryRow], error: null});
        from.mockReturnValue(query);
        const models = await getModels();
        expect(from).toHaveBeenCalledWith("model_summaries");
        // Only the summary columns (Phase 33), never "*".
        expect(query.calls).toContainEqual(["select", [SUMMARY_COLUMNS]]);
        expect(models).toHaveLength(1);
        expect(models[0]!.slug).toBe(summaryRow.slug);
    });

    it("getRecentlyAddedModels reads model_summaries too", async () => {
        from.mockReturnValue(chainable({data: [summaryRow], error: null}));
        const models = await getRecentlyAddedModels(5);
        expect(from).toHaveBeenCalledWith("model_summaries");
        expect(models).toHaveLength(1);
    });

    it("surfaces a Supabase error as an AppError", async () => {
        from.mockReturnValue(chainable({data: null, error: {message: "down", code: "503", status: 503}}));
        await expect(getModels()).rejects.toMatchObject({kind: "unavailable"});
    });
});

describe("getModelBySlug", () => {
    beforeEach(() => {
        from.mockReset();
    });

    const modelRow = {
        id: "m-1",
        slug: "abarth-124-rally-rgt-2017-altaya-green",
        name: "Abarth 124 Rally RGT",
        year: 2017,
        scale: "1:43",
        brand_id: "b-1",
        manufacturer_id: "mf-1",
        category_id: "c-1",
        driver_id: "d-1",
        is_racing: true,
        car_number: "27",
        livery_hex: ["#469F18"],
        team: null,
        event: null,
        series: null,
        condition: null,
        location: null,
        added_at: null,
        description: null,
        key_features: [],
        is_published: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        brand: {id: "b-1", slug: "abarth", name: "Abarth", logo_path: "/brands/Abarth.svg", created_at: "", updated_at: ""},
        manufacturer: {id: "mf-1", slug: "altaya", name: "Altaya", logo_path: "/manufacturers/Altaya.svg", created_at: "", updated_at: ""},
        category: {id: "c-1", slug: "rally", name: "Rally", sort_order: 10, created_at: "", updated_at: ""},
        driver: {id: "d-1", slug: "gabriele-noberasco", name: "Gabriele Noberasco", country_code: null, created_at: "", updated_at: ""},
    };
    const colorRows = [{position: 0, color: {id: "col-1", slug: "green", name: "Green", hex: "#2E9E45", sort_order: 90, created_at: "", updated_at: ""}}];
    const imageRows = [{
        id: "img-1", model_id: "m-1", position: 0, is_primary: true,
        storage_path: null, external_url: "https://example.com/full.png",
        thumb_storage_path: null, thumb_external_url: "https://example.com/thumb.png",
        width: null, height: null, alt: null, created_at: "", updated_at: "",
    }];

    const tagRows = [
        {tag: {id: "t-2", slug: "wrc", name: "WRC", created_at: "", updated_at: ""}},
        {tag: {id: "t-1", slug: "italian", name: "Italian", created_at: "", updated_at: ""}},
        {tag: null},
    ];

    it("fetches the model, its colors, images and tags — and combines them", async () => {
        from.mockImplementation((table: string) => {
            if (table === "models") return chainable({data: modelRow, error: null});
            if (table === "model_colors") return chainable({data: colorRows, error: null});
            if (table === "model_images") return chainable({data: imageRows, error: null});
            if (table === "model_tags") return chainable({data: tagRows, error: null});
            throw new Error(`unexpected table ${table}`);
        });

        const model = await getModelBySlug("abarth-124-rally-rgt-2017-altaya-green");

        expect(from).toHaveBeenCalledWith("models");
        expect(from).toHaveBeenCalledWith("model_colors");
        expect(from).toHaveBeenCalledWith("model_images");
        expect(model.name).toBe("Abarth 124 Rally RGT");
        expect(model.colors).toEqual([{slug: "green", name: "Green"}]);
        expect(model.images).toHaveLength(1);
        expect(from).toHaveBeenCalledWith("model_tags");
        expect(model.tags).toEqual([{slug: "italian", name: "Italian"}, {slug: "wrc", name: "WRC"}]);
    });

    it("asks for everything at once — the children are filtered by the model's slug, not its id", async () => {
        const queries = new Map<string, ReturnType<typeof chainable>>();
        let inFlight = 0;
        let maxInFlight = 0;
        from.mockImplementation((table: string) => {
            const data = {models: modelRow, model_colors: colorRows, model_images: imageRows, model_tags: tagRows}[table];
            const query = chainable({data, error: null});
            // Count queries started before any has been awaited: all four, if nothing waits on the model row.
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            queueMicrotask(() => inFlight--);
            queries.set(table, query);
            return query;
        });

        await getModelBySlug("abarth-124-rally-rgt-2017-altaya-green");

        expect(maxInFlight).toBe(4);
        for (const table of ["model_colors", "model_images", "model_tags"]) {
            expect(queries.get(table)!.calls).toContainEqual(["eq", ["model.slug", "abarth-124-rally-rgt-2017-altaya-green"]]);
        }
    });

    it("surfaces a not-found error for an unknown slug (.single() with 0 rows)", async () => {
        from.mockReturnValue(chainable({data: null, error: {message: "no rows", code: "PGRST116"}}));
        await expect(getModelBySlug("nope")).rejects.toMatchObject({kind: "not_found"});
    });
});
