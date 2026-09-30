import {describe, expect, it} from "vitest";

import type {Model} from "../services/types.ts";
import {
    formatAddedDate,
    formatColors,
    formatCondition,
    getAvailableTabs,
    getCollectionFacts,
    getRacingSpecs,
    resolveTab,
    tabLabel,
} from "./model-details.ts";

// Mirrors what every imported model looks like today: no description/features/tags, one image,
// no condition/location, added_at only for some.
const base: Model = {
    id: "m-1",
    slug: "ford-gt-2006-ixo-blue",
    name: "Ford GT",
    year: 2006,
    scale: "1:43",
    isRacing: false,
    carNumber: null,
    liveryHex: ["#1F4E9E"],
    team: null,
    event: null,
    series: null,
    condition: null,
    location: null,
    addedAt: null,
    createdAt: "",
    updatedAt: "",
    brand: {slug: "ford", name: "Ford", logoPath: null},
    manufacturer: {slug: "ixo", name: "IXO", logoPath: null},
    category: {slug: "supercar", name: "Supercar", sortOrder: 0},
    driver: null,
    colors: [{slug: "blue", name: "Blue"}],
    description: null,
    keyFeatures: [],
    tags: [],
    isPublished: true,
    images: [{id: "i-1", position: 0, isPrimary: true, url: "full.png", thumbUrl: "thumb.png", width: null, height: null, alt: null}],
};

describe("getAvailableTabs", () => {
    it("a model with no extra data still has Specifications, and nothing else", () => {
        expect(getAvailableTabs(base)).toEqual(["specifications"]);
    });

    it("Overview appears for a description, key features or tags — each on its own", () => {
        expect(getAvailableTabs({...base, description: "About it."})).toEqual(["overview", "specifications"]);
        expect(getAvailableTabs({...base, keyFeatures: ["Opening doors"]})).toEqual(["overview", "specifications"]);
        expect(getAvailableTabs({...base, tags: [{slug: "v8", name: "V8"}]})).toEqual(["overview", "specifications"]);
    });

    it("a whitespace-only description is not an Overview", () => {
        expect(getAvailableTabs({...base, description: "   "})).toEqual(["specifications"]);
    });

    it("Gallery only once there is more than the one primary image", () => {
        const second = {...base.images[0]!, id: "i-2", position: 1, isPrimary: false};
        expect(getAvailableTabs({...base, images: [...base.images, second]})).toEqual(["specifications", "gallery"]);
        expect(getAvailableTabs({...base, images: []})).toEqual(["specifications"]);
    });

    it("My Collection only when a public collection field is set", () => {
        expect(getAvailableTabs({...base, addedAt: "2025-04-12"})).toEqual(["specifications", "collection"]);
        expect(getAvailableTabs({...base, location: "Display Cabinet"})).toEqual(["specifications", "collection"]);
    });
});

describe("resolveTab", () => {
    const available = ["overview", "specifications"] as const;

    it("keeps a valid, available tab", () => {
        expect(resolveTab("specifications", available)).toBe("specifications");
    });

    it("falls back to the first available tab for missing, unknown or unavailable values", () => {
        expect(resolveTab(null, available)).toBe("overview");
        expect(resolveTab("nope", available)).toBe("overview");
        expect(resolveTab("gallery", available)).toBe("overview");
        expect(resolveTab("notes", available)).toBe("overview");
    });
});

describe("tabLabel", () => {
    it("counts gallery images", () => {
        expect(tabLabel("gallery", {images: [base.images[0]!, base.images[0]!]})).toBe("Gallery (2)");
        expect(tabLabel("collection", base)).toBe("My Collection");
    });
});

describe("getRacingSpecs", () => {
    it("is empty for road cars, even if a stray racing field is set", () => {
        expect(getRacingSpecs({...base, carNumber: "3"})).toEqual([]);
    });

    it("lists only the racing fields that exist (audit D7)", () => {
        expect(getRacingSpecs({...base, isRacing: true, carNumber: "3"})).toEqual([{label: "Car number", value: "#3"}]);
        expect(getRacingSpecs({...base, isRacing: true})).toEqual([]);
        expect(getRacingSpecs({
            ...base,
            isRacing: true,
            carNumber: "27",
            driver: {slug: "x", name: "Gabriele Noberasco", countryCode: "IT"},
            team: " Abarth Rally Team ",
            series: "ERC",
            event: "  ",
        })).toEqual([
            {label: "Car number", value: "#27"},
            {label: "Driver", value: "Gabriele Noberasco"},
            {label: "Team", value: "Abarth Rally Team"},
            {label: "Series", value: "ERC"},
        ]);
    });
});

describe("formatColors", () => {
    it("joins color names, null when there are none", () => {
        expect(formatColors({colors: [{slug: "red", name: "Red"}, {slug: "white", name: "White"}]})).toBe("Red / White");
        expect(formatColors({colors: []})).toBeNull();
    });
});

describe("formatCondition", () => {
    it("labels the schema's condition values and passes unknown ones through", () => {
        expect(formatCondition("near_mint")).toBe("Near Mint");
        expect(formatCondition("mint")).toBe("Mint");
        expect(formatCondition("custom")).toBe("custom");
    });
});

describe("formatAddedDate", () => {
    it("formats a date column as in the mockup, independent of locale data", () => {
        expect(formatAddedDate("2025-04-12")).toBe("12 Apr 2025");
        expect(formatAddedDate("2026-01-01")).toBe("1 Jan 2026");
        expect(formatAddedDate("2026-09-09")).toBe("9 Sep 2026");
    });

    it("is null for anything that isn't a plain date", () => {
        expect(formatAddedDate("")).toBeNull();
        expect(formatAddedDate("12/04/2025")).toBeNull();
        expect(formatAddedDate("2025-13-45")).toBeNull();
        expect(formatAddedDate("2025-02-30")).toBeNull();
    });
});

describe("getCollectionFacts", () => {
    it("is empty when no public collection field is set", () => {
        expect(getCollectionFacts(base)).toEqual([]);
    });

    it("lists added / condition / location in mockup order", () => {
        expect(getCollectionFacts({addedAt: "2025-04-12", condition: "near_mint", location: "Display Cabinet"})).toEqual([
            {label: "Added", value: "12 Apr 2025"},
            {label: "Condition", value: "Near Mint"},
            {label: "Location", value: "Display Cabinet"},
        ]);
    });
});
