import {afterEach, describe, expect, it, vi} from "vitest";

import type {Tables} from "../lib/database.types.ts";

import {mapCategory, mapDriver, mapModel, mapModelImage, mapModelSummary, SUMMARY_COLUMNS, type SummaryRow} from "./mappers.ts";

function summaryRow(overrides: Partial<SummaryRow> = {}): SummaryRow {
    return {
        slug: "abarth-124-rally-rgt-2017-altaya-green",
        name: "Abarth 124 Rally RGT",
        year: 2017,
        scale: "1:43",
        is_racing: true,
        car_number: "27",
        livery_hex: ["#469F18", "#1B1C21"],
        team: null,
        event: null,
        series: null,
        condition: null,
        location: null,
        added_at: null,
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
        ...overrides,
    };
}

describe("mapModelSummary", () => {
    // getModels() selects SUMMARY_COLUMNS (Phase 33): exactly what the mapper reads — nothing it
    // needs missing, and not the view's id/is_published/timestamps.
    it("is fed exactly the selected summary columns", () => {
        const selected = SUMMARY_COLUMNS.split(",");
        expect([...selected].sort()).toEqual(Object.keys(summaryRow()).sort());
        for (const unused of ["id", "is_published", "created_at", "updated_at"]) expect(selected).not.toContain(unused);
    });

    it("maps every field to the domain shape", () => {
        const model = mapModelSummary(summaryRow());
        expect(model).toEqual({
            slug: "abarth-124-rally-rgt-2017-altaya-green",
            name: "Abarth 124 Rally RGT",
            year: 2017,
            scale: "1:43",
            isRacing: true,
            carNumber: "27",
            liveryHex: ["#469F18", "#1B1C21"],
            team: null,
            event: null,
            series: null,
            condition: null,
            location: null,
            addedAt: null,
            brand: {slug: "abarth", name: "Abarth", logoPath: "/brands/Abarth.svg"},
            manufacturer: {slug: "altaya", name: "Altaya", logoPath: "/manufacturers/Altaya.svg"},
            category: {slug: "rally", name: "Rally", sortOrder: 10},
            driver: {slug: "gabriele-noberasco", name: "Gabriele Noberasco", countryCode: null},
            colors: [{slug: "green", name: "Green"}],
            image: {
                url: "https://i.postimg.cc/Twq7K6pg/abarth.png",
                thumbUrl: "https://i.postimg.cc/BQgjMw17/abarth-thumb.png",
                width: null,
                height: null,
            },
            imageCount: 1,
        });
    });

    it("maps a road car with no driver to a null driver", () => {
        const model = mapModelSummary(summaryRow({driver_slug: null, driver_name: null, driver_country_code: null, is_racing: false, car_number: null}));
        expect(model.driver).toBeNull();
        expect(model.isRacing).toBe(false);
        expect(model.carNumber).toBeNull();
    });

    it("maps no image row to a null image", () => {
        const model = mapModelSummary(summaryRow({image_external_url: null, image_storage_path: null, thumb_external_url: null, thumb_storage_path: null, image_count: 0}));
        expect(model.image).toBeNull();
        expect(model.imageCount).toBe(0);
    });

    it("prefers storage_path over external_url when both are set, resolved to a public Storage URL (Phase 20/21)", () => {
        vi.stubEnv("VITE_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
        const model = mapModelSummary(summaryRow({image_storage_path: "models/abarth/0-full.webp", thumb_storage_path: "models/abarth/0-thumb.webp"}));
        const bucket = "https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/model-images";
        expect(model.image?.url).toBe(`${bucket}/models/abarth/0-full.webp`);
        expect(model.image?.thumbUrl).toBe(`${bucket}/models/abarth/0-thumb.webp`);
    });

    it("throws on a row missing required fields (defensive — should never happen given NOT NULL columns)", () => {
        expect(() => mapModelSummary(summaryRow({name: null}))).toThrow();
    });
});

describe("mapCategory / mapDriver / mapModelImage", () => {
    it("maps a categories row", () => {
        expect(mapCategory({id: "x", slug: "racing", name: "Racing", sort_order: 20, created_at: "", updated_at: ""})).toEqual({
            slug: "racing",
            name: "Racing",
            sortOrder: 20,
        });
    });

    it("maps a drivers row", () => {
        expect(mapDriver({id: "x", slug: "max", name: "Max", country_code: "GB", created_at: "", updated_at: ""})).toEqual({
            slug: "max",
            name: "Max",
            countryCode: "GB",
        });
    });

    it("maps a model_images row, preferring storage over external", () => {
        const image = mapModelImage({
            id: "img-1",
            model_id: "m-1",
            position: 0,
            is_primary: true,
            storage_path: null,
            external_url: "https://example.com/full.png",
            thumb_storage_path: null,
            thumb_external_url: "https://example.com/thumb.png",
            width: 800,
            height: 600,
            alt: null,
            created_at: "",
            updated_at: "",
        });
        expect(image).toEqual({
            id: "img-1",
            position: 0,
            isPrimary: true,
            url: "https://example.com/full.png",
            thumbUrl: "https://example.com/thumb.png",
            width: 800,
            height: 600,
            alt: null,
        });
    });

    it("keeps owner-written alt text, treating a blank one as none", () => {
        const row = {
            id: "img-2", model_id: "m-1", position: 1, is_primary: false,
            storage_path: null, external_url: "https://example.com/rear.png",
            thumb_storage_path: null, thumb_external_url: null,
            width: null, height: null, alt: " Rear three-quarter view ", created_at: "", updated_at: "",
        };
        expect(mapModelImage(row).alt).toBe("Rear three-quarter view");
        expect(mapModelImage({...row, alt: "   "}).alt).toBeNull();
    });
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("mapModel", () => {
    const baseRow: Tables<"models"> = {
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
        description: "A rally legend.",
        key_features: ["Opening doors"],
        is_published: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    };
    const brand: Tables<"brands"> = {id: "b-1", slug: "abarth", name: "Abarth", logo_path: "/brands/Abarth.svg", created_at: "", updated_at: ""};
    const manufacturer: Tables<"manufacturers"> = {id: "mf-1", slug: "altaya", name: "Altaya", logo_path: "/manufacturers/Altaya.svg", created_at: "", updated_at: ""};
    const category: Tables<"categories"> = {id: "c-1", slug: "rally", name: "Rally", sort_order: 10, created_at: "", updated_at: ""};
    const driver: Tables<"drivers"> = {id: "d-1", slug: "gabriele-noberasco", name: "Gabriele Noberasco", country_code: null, created_at: "", updated_at: ""};
    const color: Tables<"colors"> = {id: "col-1", slug: "green", name: "Green", hex: "#2E9E45", sort_order: 90, created_at: "", updated_at: ""};

    it("combines the model row, its singular relations, and separately-fetched colors/images", () => {
        const model = mapModel(
            {...baseRow, brand, manufacturer, category, driver},
            [{position: 0, color}],
            [{id: "img-1", model_id: "m-1", position: 0, is_primary: true, storage_path: null, external_url: "https://example.com/full.png", thumb_storage_path: null, thumb_external_url: "https://example.com/thumb.png", width: null, height: null, alt: null, created_at: "", updated_at: ""}],
        );
        expect(model.slug).toBe("abarth-124-rally-rgt-2017-altaya-green");
        expect(model.description).toBe("A rally legend.");
        expect(model.keyFeatures).toEqual(["Opening doors"]);
        expect(model.isPublished).toBe(true);
        expect(model.brand).toEqual({slug: "abarth", name: "Abarth", logoPath: "/brands/Abarth.svg"});
        expect(model.driver).toEqual({slug: "gabriele-noberasco", name: "Gabriele Noberasco", countryCode: null});
        expect(model.colors).toEqual([{slug: "green", name: "Green"}]);
        expect(model.images).toHaveLength(1);
    });

    it("maps a road car with no driver to a null driver", () => {
        const model = mapModel({...baseRow, brand, manufacturer, category, driver: null}, [], []);
        expect(model.driver).toBeNull();
    });

    it("drops orphaned model_colors rows (color deleted but the join row lingered)", () => {
        const model = mapModel({...baseRow, brand, manufacturer, category, driver: null}, [{position: 0, color: null}], []);
        expect(model.colors).toEqual([]);
    });

    it("throws if a required relation (brand/manufacturer/category) is missing — RLS/FK make this defensive-only", () => {
        expect(() => mapModel({...baseRow, brand: null, manufacturer, category, driver: null}, [], [])).toThrow();
    });
});
