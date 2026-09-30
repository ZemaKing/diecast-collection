import {describe, expect, it} from "vitest";

import type {Model} from "../services/types.ts";
import {
    emptyModelForm,
    firstErrorField,
    generateModelSlug,
    isFormDirty,
    liveryFromColors,
    localDateString,
    modelToFormValues,
    normalizeHex,
    toSavePayload,
    validateModelForm,
    type ModelFormValues,
} from "./model-form.ts";

const ctx = {isNew: true, currentYear: 2026};

const model: Model = {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "abarth-124-rally-rgt-2017-altaya-green",
    name: "Abarth 124 Rally RGT",
    year: 2017,
    scale: "1:43",
    isRacing: true,
    carNumber: "27",
    liveryHex: ["#469F18", "#FFFFFF"],
    team: null,
    event: null,
    series: null,
    condition: null,
    location: null,
    addedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    brand: {slug: "abarth", name: "Abarth", logoPath: "/brands/Abarth.svg"},
    manufacturer: {slug: "altaya", name: "Altaya", logoPath: "/manufacturers/Altaya.svg"},
    category: {slug: "rally", name: "Rally", sortOrder: 10},
    driver: {slug: "gabriele-noberasco", name: "Gabriele Noberasco", countryCode: null},
    colors: [{slug: "green", name: "Green"}],
    description: "Kept out of the form (Phase 26).",
    keyFeatures: ["Not touched"],
    tags: [{slug: "iconic", name: "Iconic"}],
    isPublished: true,
    images: [],
};

function validNew(): ModelFormValues {
    return {
        ...emptyModelForm("2026-09-30"),
        name: "Chevrolet Corvette Stingray",
        year: "2020",
        brand: {slug: "chevrolet", name: "Chevrolet", isNew: false},
        manufacturer: {slug: "ixo", name: "IXO", isNew: false},
        categorySlug: "supercar",
        colorSlugs: ["yellow"],
        liveryHex: ["#FFD200"],
        slug: "chevrolet-corvette-stingray-2020-ixo-yellow",
    };
}

describe("generateModelSlug", () => {
    it("follows the legacy {brand}-{model}-{year}-{manufacturer}-{color} convention", () => {
        // Real ids from car-models.json: the name already starts with the brand, which isn't repeated.
        expect(generateModelSlug({name: "Ferrari 499P", year: "2023", brand: "Ferrari", manufacturer: "Burago", color: "red"}))
            .toBe("ferrari-499p-2023-burago-red");
        expect(generateModelSlug({name: "Citroën Xsara Kit Car", year: "2001", brand: "Citroën", manufacturer: "Altaya", color: "red"}))
            .toBe("citroen-xsara-kit-car-2001-altaya-red");
        expect(generateModelSlug({name: "Mercedes-Benz 450 SLC 5.0", year: "1979", brand: "Mercedes-Benz", manufacturer: "Altaya", color: "silver"}))
            .toBe("mercedes-benz-450-slc-5-0-1979-altaya-silver");
    });

    it("adds the brand when the name doesn't start with it", () => {
        expect(generateModelSlug({name: "Integra GS-R", year: "1996", brand: "Acura", manufacturer: "Altaya", color: "red"}))
            .toBe("acura-integra-gs-r-1996-altaya-red");
        // "Ford" is a prefix of "Fordson", not the brand word — still added.
        expect(generateModelSlug({name: "Fordson Major", year: "1950", brand: "Ford", manufacturer: "Ixo", color: "blue"}))
            .toBe("ford-fordson-major-1950-ixo-blue");
    });

    it("leaves out parts that aren't filled in yet", () => {
        expect(generateModelSlug({name: "", year: "", brand: null, manufacturer: null, color: null})).toBe("");
        expect(generateModelSlug({name: "Lancia Stratos", year: "", brand: null, manufacturer: "Ixo", color: null})).toBe("lancia-stratos-ixo");
    });
});

describe("validateModelForm", () => {
    it("accepts a complete new model", () => {
        expect(validateModelForm(validNew(), ctx)).toEqual({});
    });

    it("requires the mockup's starred fields", () => {
        const errors = validateModelForm(emptyModelForm("2026-09-30"), ctx);
        expect(Object.keys(errors).sort()).toEqual(["brand", "categorySlug", "colorSlugs", "manufacturer", "name", "slug", "year"].sort());
        // Condition and added date are optional: 160 imported models have no date and none a condition.
        expect(errors.condition).toBeUndefined();
        expect(errors.addedAt).toBeUndefined();
    });

    it("mirrors the database CHECKs", () => {
        const bad = {
            ...validNew(),
            name: "x".repeat(121),
            year: "1884",
            colorSlugs: ["red", "blue", "green", "white"],
            liveryHex: ["#12345"],
            isRacing: true,
            carNumber: "12345",
            location: "x".repeat(81),
            addedAt: "2025-02-30",
            slug: "Not A Slug",
        };
        const errors = validateModelForm(bad, ctx);
        expect(Object.keys(errors).sort()).toEqual(["addedAt", "carNumber", "colorSlugs", "liveryHex", "location", "name", "slug", "year"].sort());
    });

    it("allows next year's model but not later", () => {
        expect(validateModelForm({...validNew(), year: "2027"}, ctx).year).toBeUndefined();
        expect(validateModelForm({...validNew(), year: "2028"}, ctx).year).toMatch(/1885 and 2027/);
    });

    it("ignores racing fields on a non-racing model", () => {
        expect(validateModelForm({...validNew(), isRacing: false, carNumber: "#!", team: "x".repeat(200)}, ctx)).toEqual({});
    });

    it("checks names typed into a picker that will create a new row", () => {
        const values = {...validNew(), brand: {slug: "", name: "北京", isNew: true}};
        expect(validateModelForm(values, ctx).brand).toMatch(/letter or digit/);
    });

    it("skips slug checks when editing (the slug is fixed)", () => {
        expect(validateModelForm({...validNew(), slug: ""}, {...ctx, isNew: false})).toEqual({});
    });

    it("reports the first invalid field top to bottom", () => {
        expect(firstErrorField(validateModelForm({...validNew(), year: "", colorSlugs: []}, ctx))).toBe("year");
        expect(firstErrorField({})).toBeUndefined();
    });
});

describe("modelToFormValues → toSavePayload (round trip)", () => {
    it("saving an unchanged imported model sends exactly its stored core fields", () => {
        const payload = toSavePayload(modelToFormValues(model), model.isPublished);
        expect(payload).toEqual({
            slug: model.slug,
            name: "Abarth 124 Rally RGT",
            year: 2017,
            brand: {slug: "abarth", name: "Abarth"},
            manufacturer: {slug: "altaya", name: "Altaya"},
            category_slug: "rally",
            scale: "1:43",
            livery_hex: ["#469F18", "#FFFFFF"],
            color_slugs: ["green"],
            is_racing: true,
            car_number: "27",
            driver: {slug: "gabriele-noberasco", name: "Gabriele Noberasco"},
            team: null,
            event: null,
            series: null,
            condition: null,
            location: null,
            added_at: null,
            is_published: true,
        });
    });

    it("never carries the fields Phases 26–27 own", () => {
        const payload = toSavePayload(modelToFormValues(model), true) as Record<string, unknown>;
        for (const key of ["description", "key_features", "tags", "images", "notes"]) expect(payload).not.toHaveProperty(key);
    });

    it("an untouched edit form is not dirty; any change is", () => {
        const start = modelToFormValues(model);
        expect(isFormDirty(start, modelToFormValues(model))).toBe(false);
        expect(isFormDirty(start, {...start, location: "Display Cabinet"})).toBe(true);
    });
});

describe("toSavePayload", () => {
    it("trims text, empties to null, and uppercases the number and swatch", () => {
        const payload = toSavePayload({
            ...validNew(),
            name: "  Chevrolet Corvette Stingray ",
            series: "  ",
            location: " Display Cabinet ",
            isRacing: true,
            carNumber: "3a",
            team: " Corvette Racing ",
            liveryHex: ["#ffd200"],
        }, false);
        expect(payload).toMatchObject({
            name: "Chevrolet Corvette Stingray",
            series: null,
            location: "Display Cabinet",
            car_number: "3A",
            team: "Corvette Racing",
            livery_hex: ["#FFD200"],
            is_published: false,
            added_at: "2026-09-30",
        });
    });

    it("drops racing details when the model isn't a racing model", () => {
        const payload = toSavePayload({
            ...validNew(),
            isRacing: false,
            carNumber: "7",
            driver: {slug: "x", name: "X", isNew: false},
            team: "T",
            event: "E",
        }, true);
        expect(payload).toMatchObject({is_racing: false, car_number: null, driver: null, team: null, event: null});
    });

    it("marks picker names that don't exist yet for creation", () => {
        const payload = toSavePayload({...validNew(), isRacing: true, driver: {slug: "new-driver", name: " New Driver ", isNew: true}}, true);
        expect(payload.driver).toEqual({slug: "new-driver", name: "New Driver", create: true});
        expect(payload.brand).toEqual({slug: "chevrolet", name: "Chevrolet"});
    });
});

describe("swatch helpers", () => {
    it("normalizes hex input", () => {
        expect(normalizeHex("#ffd200")).toBe("#FFD200");
        expect(normalizeHex("abc")).toBe("#AABBCC");
        expect(normalizeHex("#12345")).toBeNull();
        expect(normalizeHex("red")).toBeNull();
    });

    it("suggests a swatch from the chosen colors, skipping Multi", () => {
        const colors = [{slug: "red", hex: "#FF0000"}, {slug: "multi", hex: null}, {slug: "white", hex: "#FFFFFF"}];
        expect(liveryFromColors(["white", "multi", "red"], colors)).toEqual(["#FFFFFF", "#FF0000"]);
        expect(liveryFromColors([], colors)).toEqual([]);
    });
});

describe("localDateString", () => {
    it("is the local calendar date, zero-padded", () => {
        expect(localDateString(new Date(2025, 3, 2, 23, 59))).toBe("2025-04-02");
    });
});
