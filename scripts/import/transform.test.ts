import {describe, expect, it} from "vitest";

import {loadImportInputs} from "./config.ts";
import {buildImport, canonicalDriver, type LegacyModel} from "./transform.ts";

const {models, config} = loadImportInputs();
const plan = buildImport(models, config);
const {payload} = plan;

const base: LegacyModel = {
    id: "ford-escort-rs-1990-altaya-white", name: "Ford Escort RS", year: 1990, brand: "Ford",
    manufacturer: "Altaya", category: "Rally", color: ["White"], hex: ["#FFFFFF"],
    thumbnail: "https://i.postimg.cc/a/t.png", imageUrl: "https://i.postimg.cc/a/f.png",
};
const oneOff = (overrides: Partial<LegacyModel>, extraConfig: Partial<typeof config> = {}) =>
    buildImport([{...base, ...overrides}], {...config, addedDates: {[overrides.id ?? base.id]: null}, ...extraConfig});

describe("real dataset → payload (docs/SCHEMA.md §6.4)", () => {
    it("has no errors", () => {
        expect(plan.errors).toEqual([]);
    });

    it("produces exactly the documented counts", () => {
        expect({
            models: payload.models.length,
            brands: payload.brands.length,
            manufacturers: payload.manufacturers.length,
            categories: new Set(payload.models.map((m) => m.category_slug)).size,
            colors: payload.colors.length,
            drivers: payload.drivers.length,
            model_colors: payload.model_colors.length,
            model_images: payload.model_images.length,
        }).toEqual({
            models: 227, brands: 45, manufacturers: 19, categories: 5, colors: 13,
            drivers: 138, model_colors: 244, model_images: 227,
        });
    });

    it("keeps every legacy id verbatim as the slug (D11)", () => {
        expect(payload.models.map((m) => m.slug)).toEqual(models.map((m) => m.id));
    });

    it("merges Corvette into Chevrolet (owner decision, D9)", () => {
        expect(payload.brands.map((b) => b.name)).not.toContain("Corvette");
        const c5r = payload.models.find((m) => m.slug.startsWith("corvette-c5r"))!;
        expect(c5r.brand_slug).toBe("chevrolet");
        expect(payload.models.filter((m) => m.brand_slug === "chevrolet")).toHaveLength(4);
    });

    it("applies the driver alias map (D5)", () => {
        const names = payload.drivers.map((d) => d.name);
        for (const alias of Object.keys(config.aliases)) expect(names).not.toContain(alias);
        expect(names).toContain("Sébastien Loeb");
        expect(names).toContain("Jean-Karl Verney");
        expect(names.some((n) => n.includes("‑"))).toBe(false);
    });

    it("derives is_racing from category (D7): 182 racing", () => {
        expect(payload.models.filter((m) => m.is_racing)).toHaveLength(182);
    });

    it("sets scale 1:43 everywhere (D1) and stringifies car numbers", () => {
        expect(new Set(payload.models.map((m) => m.scale))).toEqual(new Set(["1:43"]));
        const numbered = payload.models.filter((m) => m.car_number !== null);
        expect(numbered).toHaveLength(169);
        expect(numbered.every((m) => /^[0-9]+$/.test(m.car_number!))).toBe(true);
    });

    it("maps MULTI to Multi with no swatch (D4) and keeps color order", () => {
        expect(payload.colors.find((c) => c.slug === "multi")).toMatchObject({name: "Multi", hex: null});
        const acura = payload.model_colors.filter((c) => c.model_slug === "acura-integra-gsr-1996-altaya-red");
        expect(acura.map((c) => [c.color_slug, c.position])).toEqual([["red", 0], ["yellow", 1], ["white", 2]]);
    });

    it("keeps livery hex verbatim and in order (D3)", () => {
        const abarth = payload.models.find((m) => m.slug === "abarth-124-rally-rgt-2017-altaya-green")!;
        expect(abarth.livery_hex).toEqual(["#469F18", "#1B1C21"]);
    });

    it("backfills added_at for 67 models from git and leaves 160 NULL (D13)", () => {
        expect(payload.models.filter((m) => m.added_at !== null)).toHaveLength(67);
        expect(payload.models.find((m) => m.slug === "mazda-rx-8-1993-altaya-blue")!.added_at).toBe("2026-04-07");
    });

    it("references the existing postimg URLs unchanged, one primary image each", () => {
        expect(payload.model_images.every((i) => i.position === 0 && i.is_primary)).toBe(true);
        expect(payload.model_images[0].external_url).toBe(models[0].imageUrl);
        expect(payload.model_images[0].thumb_external_url).toBe(models[0].thumbnail);
    });

    it("uses the existing logo files as logo_path", () => {
        expect(payload.brands.find((b) => b.slug === "citroen")!.logo_path).toBe("/brands/Citroën.svg");
        expect(payload.manufacturers.find((m) => m.slug === "leo-models")!.logo_path).toBe("/manufacturers/Leo Models.svg");
    });

    it("itemizes the expected data-quality warnings", () => {
        const codes = plan.warnings.map((w) => w.code);
        expect(codes).toEqual(expect.arrayContaining([
            "D9-brand-merge", "D8-dropped-key", "D7-racing-without-crew", "D3-palette-vs-colors",
            "D2-driver-country", "D15-manufacturer-review", "D13-undated",
        ]));
        expect(plan.warnings.find((w) => w.code === "D7-racing-without-crew")!.ids).toHaveLength(11);
        expect(plan.warnings.find((w) => w.code === "D8-dropped-key")!.message).toContain("COMING_SOON");
    });

    it("produces only slugs the database CHECK accepts", () => {
        const slugs = [...payload.brands, ...payload.manufacturers, ...payload.colors, ...payload.drivers].map((r) => r.slug);
        expect(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))).toBe(true);
    });

    it("is deterministic", () => {
        expect(buildImport(models, config)).toEqual(plan);
    });
});

describe("validation errors (the import must not run)", () => {
    it.each([
        ["unknown category", {category: "Truck"}, "unknown-category"],
        ["unknown color", {color: ["Teal"]}, "unknown-color"],
        ["lower-case / bad hex", {hex: ["red"]}, "bad-hex"],
        ["year out of range", {year: 1700}, "bad-year"],
        ["http image", {imageUrl: "http://x/y.png"}, "bad-image-url"],
        ["driver on a road car", {category: "Supercar", carDriver: "X"}, "crew-on-road-car"],
        ["bad id", {id: "Ford Escort"}, "bad-id"],
        ["too many colors", {color: ["Red", "Blue", "White", "Black"]}, "bad-colors"],
    ] as [string, Partial<LegacyModel>, string][])("%s", (_label, overrides, code) => {
        expect(oneOff(overrides).errors.map((e) => e.code)).toContain(code);
    });

    it("flags a model missing from added-dates.json", () => {
        const result = buildImport([base], {...config, addedDates: {}});
        expect(result.errors.map((e) => e.code)).toContain("no-added-date-entry");
    });

    it("flags duplicate ids", () => {
        const result = buildImport([base, base], {...config, addedDates: {[base.id]: null}});
        expect(result.errors.map((e) => e.code)).toContain("duplicate-id");
    });

    it("flags two different names that slugify the same", () => {
        const a = {...base, id: "a-1", carDriver: "Jose Perez"};
        const b = {...base, id: "b-1", carDriver: "José Pérez"};
        const result = buildImport([a, b], {...config, aliases: {}, addedDates: {"a-1": null, "b-1": null}});
        expect(result.errors.map((e) => e.code)).toContain("slug-collision");
    });

    it("upper-cases lower-case hex before validating", () => {
        expect(oneOff({hex: ["#ffffff"]}).payload.models[0].livery_hex).toEqual(["#FFFFFF"]);
    });
});

describe("canonicalDriver", () => {
    it("normalizes non-breaking hyphens and applies aliases", () => {
        expect(canonicalDriver("Jean‑Karl Verney", {})).toBe("Jean-Karl Verney");
        expect(canonicalDriver(" Sebastien Loeb ", {"Sebastien Loeb": "Sébastien Loeb"})).toBe("Sébastien Loeb");
    });

    it("normalizes decomposed accents to NFC", () => {
        expect(canonicalDriver("Sébastien Loeb", {})).toBe("Sébastien Loeb");
    });
});
