import {describe, expect, it} from "vitest";

import type {Model} from "../services/types.ts";
import {
    emptyModelForm,
    firstErrorField,
    generateModelSlug,
    getChecklist,
    toPreviewSummary,
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

const photo = (id: string, position: number, isPrimary: boolean) =>
    ({id, position, isPrimary, url: `https://x.test/${id}.webp`, thumbUrl: null, width: 1200, height: 800, alt: null});
const withPhotos: Model = {...model, images: [photo("p1", 0, false), photo("p2", 1, true)]};

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
    it("saving an unchanged model sends exactly its stored fields", () => {
        const payload = toSavePayload(modelToFormValues(model, "Bought at Altaya fair"), model.isPublished);
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
            description: "Kept out of the form (Phase 26).",
            key_features: ["Not touched"],
            tags: [{slug: "iconic", name: "Iconic"}],
            notes: "Bought at Altaya fair",
        });
    });

    it("leaves images to saveModelWithImages() (new photos must be uploaded first)", () => {
        const payload = toSavePayload(modelToFormValues(withPhotos), true) as Record<string, unknown>;
        expect(payload).not.toHaveProperty("images");
    });

    it("reads the photos main-first, and validates the count", () => {
        expect(modelToFormValues(withPhotos).images.map((i) => i.kind === "existing" && i.id)).toEqual(["p2", "p1"]);
        const tooMany = Array.from({length: 11}, (_, n) => ({kind: "existing" as const, id: `i${n}`, url: null, thumbUrl: null, width: null, height: null, alt: null}));
        expect(validateModelForm({...validNew(), images: tooMany}, ctx).images).toMatch(/at most 10 photos — remove 1/);
    });

    it("sends empty rich fields as clears, dropping blank key-feature rows", () => {
        const values = {...modelToFormValues(model), description: "  \n ", keyFeatures: [" Opening doors ", "", "  "], tags: [], notes: " "};
        expect(toSavePayload(values, true)).toMatchObject({description: null, key_features: ["Opening doors"], tags: [], notes: null});
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

describe("rich-field validation (Phase 26)", () => {
    it("limits key features, tags and text lengths", () => {
        const errors = validateModelForm({
            ...validNew(),
            description: "x".repeat(10001),
            keyFeatures: Array.from({length: 13}, (_, i) => `Feature ${i}`),
            tags: Array.from({length: 21}, (_, i) => ({slug: `t${i}`, name: `T${i}`, isNew: false})),
            notes: "x".repeat(10001),
        }, ctx);
        expect(Object.keys(errors).sort()).toEqual(["description", "keyFeatures", "notes", "tags"]);
    });

    it("counts only filled key-feature rows and checks new tag names", () => {
        const blanks = {...validNew(), keyFeatures: [...Array.from({length: 12}, () => "ok"), "", " "]};
        expect(validateModelForm(blanks, ctx).keyFeatures).toBeUndefined();
        expect(validateModelForm({...validNew(), keyFeatures: ["x".repeat(201)]}, ctx).keyFeatures).toMatch(/200/);
        expect(validateModelForm({...validNew(), tags: [{slug: "x", name: "x".repeat(41), isNew: true}]}, ctx).tags).toMatch(/40/);
    });
});

describe("getChecklist", () => {
    it("ticks what's there; description is recommended, the main image is any photo in the list", () => {
        const items = getChecklist(validNew(), {currentYear: 2026});
        expect(items.filter((i) => !i.done).map((i) => i.key)).toEqual(["image", "description"]);
        expect(items.find((i) => i.key === "description")?.recommended).toBe(true);
        const photos = modelToFormValues(withPhotos).images;
        expect(getChecklist({...validNew(), description: "Nice", images: photos}, {currentYear: 2026}).every((i) => i.done)).toBe(true);
        expect(getChecklist(emptyModelForm("2026-09-30"), {currentYear: 2026}).filter((i) => i.done).map((i) => i.key)).toEqual(["scale"]);
    });
});

describe("toPreviewSummary", () => {
    const context = {
        slug: "chevrolet-corvette-stingray-2020-ixo-yellow",
        brands: [{slug: "chevrolet", name: "Chevrolet", logoPath: "/brands/Chevrolet.svg"}],
        manufacturers: [{slug: "ixo", name: "IXO", logoPath: "/manufacturers/Ixo.svg"}],
        categories: [{slug: "supercar", name: "Supercar", sortOrder: 30}],
        drivers: [{slug: "loeb", name: "Sébastien Loeb", countryCode: "FR"}],
        colors: [{slug: "yellow", name: "Yellow"}],
    };

    it("feeds the card from the form, with logos from the lookups", () => {
        const summary = toPreviewSummary({...validNew(), isRacing: true, carNumber: "3a", driver: {slug: "loeb", name: "Sébastien Loeb", isNew: false}}, context);
        expect(summary).toMatchObject({
            name: "Chevrolet Corvette Stingray",
            year: 2020,
            brand: {logoPath: "/brands/Chevrolet.svg"},
            category: {name: "Supercar"},
            carNumber: "3A",
            driver: {countryCode: "FR"},
            colors: [{slug: "yellow", name: "Yellow"}],
            liveryHex: ["#FFD200"],
        });
    });

    it("shows the first photo — stored or just picked — as the card image", () => {
        expect(toPreviewSummary(validNew(), context)).toMatchObject({image: null, imageCount: 0});
        const stored = toPreviewSummary({...validNew(), images: modelToFormValues(withPhotos).images}, context);
        expect(stored).toMatchObject({image: {url: "https://x.test/p2.webp", width: 1200}, imageCount: 2});
        const variant = {blob: new Blob(), width: 1600, height: 900, type: "image/webp", ext: "webp" as const};
        const picked = toPreviewSummary({...validNew(), images: [{kind: "new", key: "k", fileName: "a.jpg", full: variant, thumb: {...variant, width: 400, height: 225}, previewUrl: "blob:full", thumbPreviewUrl: "blob:thumb"}]}, context);
        expect(picked.image).toEqual({url: "blob:full", thumbUrl: "blob:thumb", width: 1600, height: 900});
    });

    it("shows field names instead of inventing values, and hides racing details on road cars", () => {
        const summary = toPreviewSummary({...emptyModelForm("2026-09-30"), carNumber: "7"}, context);
        expect(summary).toMatchObject({name: "Model name", year: 0, brand: {name: "Brand"}, manufacturer: {name: "Manufacturer"}, category: {name: "Category"}, carNumber: null, driver: null});
    });
});
