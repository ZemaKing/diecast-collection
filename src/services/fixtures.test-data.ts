// Test-only: derives ModelSummary[] fixtures from the real src/data/car-models.json, so
// collection-query tests exercise the same shape and distribution the services layer will once
// Phase 10 switches the UI to Supabase. Mirrors the importer's brand merge and slugging
// (scripts/import/transform.ts), not its full alias/validation pipeline — good enough for pure
// query-logic tests. Filename doesn't end in .test.ts so Vitest doesn't try to run it as a suite.
import carModels from "../data/car-models.json";
import {slugify} from "../utils/slug.ts";

import type {ModelSummary} from "./types.ts";

const BRAND_MERGES: Record<string, string> = {Corvette: "Chevrolet"};
const CATEGORY_SORT_ORDER: Record<string, number> = {Rally: 10, Racing: 20, Supercar: 30, Premium: 40, Retro: 50};
const RACING_CATEGORIES = new Set(["Rally", "Racing"]);

type LegacyModel = {
    id: string;
    name: string;
    year: number;
    brand: string;
    manufacturer: string;
    category: string;
    carNumber?: number;
    carDriver?: string;
    driverCountry?: string;
    color: string[] | string;
    hex?: string[];
    thumbnail: string;
    imageUrl: string;
    scale?: string;
};

export function buildModelSummaryFixtures(): ModelSummary[] {
    return (carModels as LegacyModel[]).map((m, index): ModelSummary => {
        const brandName = BRAND_MERGES[m.brand] ?? m.brand;
        const colorNames = Array.isArray(m.color) ? m.color : [m.color];

        return {
            id: `fixture-${index}`,
            slug: m.id,
            name: m.name,
            year: m.year,
            scale: m.scale ?? "1:43",
            isRacing: RACING_CATEGORIES.has(m.category),
            carNumber: m.carNumber != null ? String(m.carNumber) : null,
            liveryHex: (m.hex ?? []).map((h) => h.toUpperCase()),
            team: null,
            event: null,
            series: null,
            condition: null,
            location: null,
            addedAt: null,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            brand: {slug: slugify(brandName), name: brandName, logoPath: `/brands/${brandName}.svg`},
            manufacturer: {slug: slugify(m.manufacturer), name: m.manufacturer, logoPath: `/manufacturers/${m.manufacturer}.svg`},
            category: {slug: slugify(m.category), name: m.category, sortOrder: CATEGORY_SORT_ORDER[m.category] ?? 99},
            driver: m.carDriver ? {slug: slugify(m.carDriver), name: m.carDriver, countryCode: m.driverCountry ?? null} : null,
            colors: colorNames.map((c) => ({slug: slugify(c), name: c})),
            image: {url: m.imageUrl, thumbUrl: m.thumbnail, width: null, height: null},
            imageCount: 1,
        };
    });
}
