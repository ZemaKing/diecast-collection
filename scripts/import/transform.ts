// Pure JSON → import-payload transform (no I/O). Implements the mapping in docs/SCHEMA.md §6.
// Errors are fatal (the import must not run); warnings are expected data-quality notes, itemized.
import {SLUG_PATTERN, slugify} from "../../src/utils/slug.ts";

export type LegacyModel = {
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
    [unknownKey: string]: unknown;
};

export type ImportConfig = {
    aliases: Record<string, string>;
    brandMerges: Record<string, string>;
    colors: {legacy: string; name: string; hex: string | null; sort_order: number}[];
    categories: Record<string, string>;
    racingCategories: string[];
    defaultScale: string;
    addedDates: Record<string, string | null>;
    /** Manufacturers flagged for owner review (e.g. D15 "DTM"). */
    reviewManufacturers?: string[];
};

export type LookupRow = {slug: string; name: string; logo_path: string | null};

export type ImportPayload = {
    brands: LookupRow[];
    manufacturers: LookupRow[];
    colors: {slug: string; name: string; hex: string | null; sort_order: number}[];
    drivers: {slug: string; name: string}[];
    models: {
        slug: string;
        name: string;
        year: number;
        brand_slug: string;
        manufacturer_slug: string;
        category_slug: string;
        scale: string;
        livery_hex: string[];
        is_racing: boolean;
        car_number: string | null;
        driver_slug: string | null;
        added_at: string | null;
    }[];
    model_colors: {model_slug: string; color_slug: string; position: number}[];
    model_images: {
        model_slug: string;
        position: number;
        is_primary: boolean;
        external_url: string;
        thumb_external_url: string;
    }[];
};

export type Issue = {code: string; message: string; ids?: string[]};

export type ImportPlan = {
    payload: ImportPayload;
    warnings: Issue[];
    errors: Issue[];
};

const KNOWN_KEYS = new Set([
    "id", "name", "year", "brand", "manufacturer", "category", "carNumber", "carDriver",
    "driverCountry", "color", "hex", "thumbnail", "imageUrl", "scale",
]);
const HEX = /^#[0-9A-F]{6}$/;
const HTTPS = /^https:\/\/\S+$/;

/** NFC + non-breaking hyphen (U+2011) → "-", then the reviewed alias map (audit D5). */
export function canonicalDriver(raw: string, aliases: Record<string, string>): string {
    const normalized = raw.normalize("NFC").replace(/‑/g, "-").trim();
    return aliases[normalized] ?? normalized;
}

type LogoExists = (publicPath: string) => boolean;

export function buildImport(models: LegacyModel[], config: ImportConfig, logoExists: LogoExists = () => true): ImportPlan {
    const errors: Issue[] = [];
    const warnings: Issue[] = [];
    const error = (code: string, message: string, ids?: string[]) => errors.push({code, message, ids});

    const colorByLegacy = new Map(config.colors.map((c) => [c.legacy, c]));

    // Lookups keyed by slug; a second, different name with the same slug is an error.
    const lookup = (kind: string, dir: string | null) => {
        const bySlug = new Map<string, LookupRow>();
        return {
            add(name: string, modelId: string): string {
                const slug = slugify(name);
                if (!slug || !SLUG_PATTERN.test(slug)) {
                    error("bad-slug", `${kind} "${name}" has no usable slug`, [modelId]);
                    return slug;
                }
                const existing = bySlug.get(slug);
                if (existing && existing.name !== name) {
                    error("slug-collision", `${kind} "${name}" and "${existing.name}" share slug "${slug}"`, [modelId]);
                }
                if (!existing) bySlug.set(slug, {slug, name, logo_path: dir ? `/${dir}/${name}.svg` : null});
                return slug;
            },
            rows: () => [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
        };
    };
    const brands = lookup("Brand", "brands");
    const manufacturers = lookup("Manufacturer", "manufacturers");
    const drivers = lookup("Driver", null);

    const payload: ImportPayload = {brands: [], manufacturers: [], colors: [], drivers: [], models: [], model_colors: [], model_images: []};
    const seenIds = new Set<string>();
    const usedColors = new Set<string>();
    const merged: string[] = [];
    const droppedKeys = new Map<string, string[]>();
    const racingWithoutCrew: string[] = [];
    const paletteMismatch: string[] = [];
    const review: string[] = [];

    for (const m of models) {
        const id = m.id;
        if (typeof id !== "string" || !SLUG_PATTERN.test(id) || id.length > 80) {
            error("bad-id", `invalid id ${JSON.stringify(id)}`);
            continue;
        }
        if (seenIds.has(id)) error("duplicate-id", `duplicate id`, [id]);
        seenIds.add(id);

        for (const key of Object.keys(m)) {
            if (!KNOWN_KEYS.has(key)) droppedKeys.set(key, [...(droppedKeys.get(key) ?? []), id]);
        }

        const name = typeof m.name === "string" ? m.name.trim() : "";
        if (!name || name.length > 120) error("bad-name", `name missing or too long`, [id]);
        if (!Number.isInteger(m.year) || m.year < 1885 || m.year > 2100) error("bad-year", `year ${m.year}`, [id]);

        const brandName = config.brandMerges[m.brand] ?? m.brand;
        if (brandName !== m.brand) merged.push(`${id} (${m.brand} → ${brandName})`);
        const brandSlug = brands.add(brandName, id);
        const manufacturerSlug = manufacturers.add(m.manufacturer, id);
        if (config.reviewManufacturers?.includes(m.manufacturer)) review.push(id);

        const categorySlug = config.categories[m.category];
        if (!categorySlug) error("unknown-category", `category "${m.category}"`, [id]);

        const colorNames = Array.isArray(m.color) ? m.color : [m.color];
        if (colorNames.length < 1 || colorNames.length > 3) error("bad-colors", `${colorNames.length} colors (expected 1–3)`, [id]);
        colorNames.forEach((legacy, position) => {
            const color = colorByLegacy.get(legacy);
            if (!color) return error("unknown-color", `color "${legacy}"`, [id]);
            const colorSlug = slugify(color.name);
            usedColors.add(legacy);
            payload.model_colors.push({model_slug: id, color_slug: colorSlug, position});
        });
        if (new Set(colorNames).size !== colorNames.length) error("duplicate-color", `color listed twice`, [id]);

        const liveryHex = (m.hex ?? []).map((h) => String(h).toUpperCase());
        if (liveryHex.length > 8 || liveryHex.some((h) => !HEX.test(h))) error("bad-hex", `hex ${JSON.stringify(m.hex)}`, [id]);
        if (liveryHex.length !== colorNames.length) paletteMismatch.push(id);

        const categoryIsRacing = !!categorySlug && config.racingCategories.includes(categorySlug);
        const hasCrew = m.carDriver != null || m.carNumber != null;
        if (hasCrew && !categoryIsRacing) error("crew-on-road-car", `driver/number on a non-racing category`, [id]);
        if (categoryIsRacing && !hasCrew) racingWithoutCrew.push(id);

        let carNumber: string | null = null;
        if (m.carNumber != null) {
            carNumber = String(m.carNumber).toUpperCase();
            if (!/^[0-9A-Z]{1,4}$/.test(carNumber)) error("bad-car-number", `car number ${m.carNumber}`, [id]);
        }

        const driverSlug = m.carDriver ? drivers.add(canonicalDriver(m.carDriver, config.aliases), id) : null;

        if (!HTTPS.test(m.imageUrl ?? "") || !HTTPS.test(m.thumbnail ?? "")) error("bad-image-url", `image URLs must be https`, [id]);

        const addedAt = config.addedDates[id];
        if (addedAt === undefined) error("no-added-date-entry", `missing from added-dates.json (regenerate it)`, [id]);

        payload.models.push({
            slug: id,
            name,
            year: m.year,
            brand_slug: brandSlug,
            manufacturer_slug: manufacturerSlug,
            category_slug: categorySlug ?? "",
            scale: m.scale ?? config.defaultScale,
            livery_hex: liveryHex,
            is_racing: categoryIsRacing,
            car_number: carNumber,
            driver_slug: driverSlug,
            added_at: addedAt ?? null,
        });
        payload.model_images.push({
            model_slug: id,
            position: 0,
            is_primary: true,
            external_url: m.imageUrl,
            thumb_external_url: m.thumbnail,
        });
    }

    payload.brands = brands.rows();
    payload.manufacturers = manufacturers.rows();
    payload.drivers = drivers.rows().map(({slug, name}) => ({slug, name}));
    payload.colors = config.colors
        .filter((c) => usedColors.has(c.legacy))
        .map((c) => ({slug: slugify(c.name), name: c.name, hex: c.hex, sort_order: c.sort_order}));

    for (const row of [...payload.brands, ...payload.manufacturers]) {
        if (row.logo_path && !logoExists(row.logo_path)) {
            warnings.push({code: "missing-logo", message: `no file at public${row.logo_path}`});
        }
    }
    if (merged.length) warnings.push({code: "D9-brand-merge", message: `${merged.length} model(s) moved to a merged brand`, ids: merged});
    for (const [key, ids] of droppedKeys) warnings.push({code: "D8-dropped-key", message: `unknown key "${key}" not imported`, ids});
    if (racingWithoutCrew.length) {
        warnings.push({code: "D7-racing-without-crew", message: `${racingWithoutCrew.length} Rally/Racing model(s) have neither driver nor number`, ids: racingWithoutCrew});
    }
    if (paletteMismatch.length) {
        warnings.push({code: "D3-palette-vs-colors", message: `${paletteMismatch.length} model(s) have a different number of hex swatches than filter colors (expected, informational)`});
    }
    if (payload.drivers.length) {
        warnings.push({code: "D2-driver-country", message: `${payload.drivers.length} driver(s) without country_code (none in the source data)`});
    }
    if (review.length) warnings.push({code: "D15-manufacturer-review", message: `manufacturer needs owner review`, ids: review});
    const undated = payload.models.filter((m) => m.added_at === null).length;
    if (undated) warnings.push({code: "D13-undated", message: `${undated} model(s) without added_at (catalogued on the repo's first day)`});

    return {payload, warnings, errors};
}
