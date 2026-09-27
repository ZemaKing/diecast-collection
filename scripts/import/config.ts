// Loads the versioned import inputs from scripts/import/*.json and the legacy car data.
import {readFileSync} from "node:fs";

import type {ImportConfig, LegacyModel} from "./transform.ts";

const read = <T>(relative: string): T => JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8")) as T;

export function loadImportInputs(): {models: LegacyModel[]; config: ImportConfig} {
    const lookups = read<{
        brandMerges: Record<string, string>;
        colors: {list: ImportConfig["colors"]};
        categories: Record<string, string> & {_comment?: string};
        racingCategories: string[];
        reviewManufacturers?: string[];
        defaultScale: string;
    }>("./lookups.json");
    const {_comment: _ignored, ...categories} = lookups.categories;
    void _ignored;

    return {
        // Cars only — trucks are intentionally not imported (ROADMAP architecture, Phase 11).
        models: read<LegacyModel[]>("../../src/data/car-models.json"),
        config: {
            aliases: read<{aliases: Record<string, string>}>("./driver-aliases.json").aliases,
            brandMerges: lookups.brandMerges,
            colors: lookups.colors.list,
            categories,
            racingCategories: lookups.racingCategories,
            reviewManufacturers: lookups.reviewManufacturers,
            defaultScale: lookups.defaultScale,
            addedDates: read<{dates: Record<string, string | null>}>("./added-dates.json").dates,
        },
    };
}
