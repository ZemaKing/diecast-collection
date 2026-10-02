import {describe, expect, it} from "vitest";

import {
    checkLogoFile,
    countUsage,
    deleteBlockedReason,
    draftToWrite,
    filterLookupRows,
    isLookupDraftChanged,
    isUploadedLogo,
    logoStorageKey,
    lookupCollectionPath,
    lookupSlugFor,
    lookupToDraft,
    parseLookupTab,
    validateLookupDraft,
    type LookupRow,
} from "./lookup-admin.ts";

const row = (over: Partial<LookupRow>): LookupRow => ({
    id: "id", slug: "x", name: "X", logoPath: null, countryCode: null, hex: null, sortOrder: 0, count: 0, ...over,
});

const brands = [row({slug: "citroen", name: "Citroën"}), row({slug: "ford", name: "Ford"})];

describe("validateLookupDraft", () => {
    const draft = (name: string, extra = {}) => ({...lookupToDraft(null, name), ...extra});

    it("accepts a new, distinct name", () => {
        expect(validateLookupDraft("brands", draft("Alpine"), brands, null)).toEqual({});
    });

    it("requires a name within the table's limit", () => {
        expect(validateLookupDraft("brands", draft("  "), brands, null).name).toMatch(/name/);
        expect(validateLookupDraft("tags", draft("x".repeat(41)), [], null).name).toMatch(/40/);
        expect(validateLookupDraft("brands", draft("x".repeat(80)), [], null)).toEqual({});
    });

    it("refuses a duplicate name, case-insensitively", () => {
        expect(validateLookupDraft("brands", draft("FORD"), brands, null).name).toMatch(/already a brand called/);
    });

    it("refuses a new name whose address another row has (Citroen vs Citroën)", () => {
        expect(validateLookupDraft("brands", draft("Citroen"), brands, null).name).toMatch(/address “citroen”/);
    });

    it("refuses a name with nothing to make an address from", () => {
        expect(validateLookupDraft("tags", draft("★★"), [], null).name).toMatch(/letter or digit/);
    });

    it("lets a row keep its own name when edited, and ignores the address", () => {
        expect(validateLookupDraft("brands", draft("Citroën"), brands, {slug: "citroen"})).toEqual({});
        expect(validateLookupDraft("brands", draft("Ford"), brands, {slug: "citroen"}).name).toMatch(/already/);
    });

    it("checks a driver's country code", () => {
        expect(validateLookupDraft("drivers", draft("Kalle", {countryCode: "fi"}), [], null)).toEqual({});
        expect(validateLookupDraft("drivers", draft("Kalle", {countryCode: ""}), [], null)).toEqual({});
        expect(validateLookupDraft("drivers", draft("Kalle", {countryCode: "FIN"}), [], null).countryCode).toBeDefined();
    });

    it("needs a swatch for a color unless it's multi-color", () => {
        expect(validateLookupDraft("colors", draft("Teal", {hex: "#008080"}), [], null)).toEqual({});
        expect(validateLookupDraft("colors", draft("Teal", {hex: "teal"}), [], null).hex).toBeDefined();
        expect(validateLookupDraft("colors", draft("Rainbow", {hex: "", multiColor: true}), [], null)).toEqual({});
    });
});

describe("draftToWrite / isLookupDraftChanged", () => {
    it("writes only the columns of that table, normalized", () => {
        const draft = {name: " Kalle Rovanperä ", countryCode: "fi", hex: "#abcdef", multiColor: false};
        expect(draftToWrite("drivers", draft)).toEqual({name: "Kalle Rovanperä", country_code: "FI"});
        expect(draftToWrite("colors", draft)).toEqual({name: "Kalle Rovanperä", hex: "#ABCDEF"});
        expect(draftToWrite("colors", {...draft, multiColor: true})).toEqual({name: "Kalle Rovanperä", hex: null});
        expect(draftToWrite("brands", draft)).toEqual({name: "Kalle Rovanperä"});
        expect(draftToWrite("drivers", {...draft, countryCode: " "})).toEqual({name: "Kalle Rovanperä", country_code: null});
    });

    it("an untouched draft is unchanged", () => {
        const driver = row({name: "Kalle", countryCode: "FI"});
        expect(isLookupDraftChanged("drivers", driver, lookupToDraft(driver))).toBe(false);
        expect(isLookupDraftChanged("drivers", driver, {...lookupToDraft(driver), countryCode: "SE"})).toBe(true);
        const multi = row({name: "Multi", hex: null});
        expect(lookupToDraft(multi).multiColor).toBe(true);
        expect(isLookupDraftChanged("colors", multi, lookupToDraft(multi))).toBe(false);
    });
});

describe("logos", () => {
    it("accepts SVG up to 256 KB and raster files up to 5 MB", () => {
        expect(checkLogoFile({name: "Alpine.svg", type: "image/svg+xml", size: 20_000})).toEqual({ok: true, format: "svg"});
        expect(checkLogoFile({name: "Alpine.svg", type: "", size: 300_000}).ok).toBe(false);
        expect(checkLogoFile({name: "a.PNG", type: "", size: 1_000_000})).toEqual({ok: true, format: "raster"});
        expect(checkLogoFile({name: "a.jpg", type: "image/jpeg", size: 6_000_000}).ok).toBe(false);
        expect(checkLogoFile({name: "a.gif", type: "image/gif", size: 10})).toMatchObject({ok: false, reason: expect.stringMatching(/SVG, PNG/)});
    });

    it("builds a fresh Storage key per upload", () => {
        expect(logoStorageKey("brands", "alpine", "1a2b3c", "svg")).toBe("brands/alpine-1a2b3c.svg");
    });

    it("tells uploaded logos from the files shipped in public/", () => {
        expect(isUploadedLogo("brands/alpine-1a2b3c.svg")).toBe(true);
        expect(isUploadedLogo("/brands/Alpine.svg")).toBe(false);
        expect(isUploadedLogo("https://example.com/a.svg")).toBe(false);
        expect(isUploadedLogo("blob:http://localhost/x")).toBe(false);
        expect(isUploadedLogo(null)).toBe(false);
        expect(isUploadedLogo("  ")).toBe(false);
    });
});

describe("usage and listing", () => {
    it("counts references per id", () => {
        expect(countUsage(["a", "b", "a", null, undefined])).toEqual(new Map([["a", 2], ["b", 1]]));
    });

    it("blocks deleting a row in use, and categories always", () => {
        expect(deleteBlockedReason("brands", {count: 0})).toBeNull();
        expect(deleteBlockedReason("brands", {count: 3})).toMatch(/Used by 3 models/);
        expect(deleteBlockedReason("drivers", {count: 1})).toMatch(/1 model\. Merge/);
        expect(deleteBlockedReason("categories", {count: 0})).toMatch(/renamed/);
    });

    it("filters diacritic-insensitively and sorts by name or usage", () => {
        const rows = [row({slug: "ford", name: "Ford", count: 5}), row({slug: "citroen", name: "Citroën", count: 9}), row({slug: "alpine", name: "Alpine", count: 5})];
        expect(filterLookupRows(rows, "citro").map((r) => r.slug)).toEqual(["citroen"]);
        expect(filterLookupRows(rows, "").map((r) => r.slug)).toEqual(["alpine", "citroen", "ford"]);
        expect(filterLookupRows(rows, "", "count").map((r) => r.slug)).toEqual(["citroen", "alpine", "ford"]);
    });

    it("links to the collection filter where one exists", () => {
        expect(lookupCollectionPath("brands", "aston-martin")).toBe("/?brand=aston-martin");
        expect(lookupCollectionPath("colors", "red")).toBe("/?color=red");
        expect(lookupCollectionPath("drivers", "x")).toBeNull();
        expect(lookupCollectionPath("tags", "x")).toBeNull();
    });

    it("parses the tab, defaulting to brands", () => {
        expect(parseLookupTab("drivers")).toBe("drivers");
        expect(parseLookupTab("nope")).toBe("brands");
        expect(parseLookupTab(null)).toBe("brands");
    });

    it("derives a new row's address from its name", () => {
        expect(lookupSlugFor(" Leo Models ")).toBe("leo-models");
        expect(lookupSlugFor("Škoda")).toBe("skoda");
    });
});
