// Pure logic behind the admin model form (ROADMAP Phases 25–27): the form's values, how a stored
// model becomes form values and form values become a save payload, the generated slug,
// validation, the completeness checklist and the live-preview card. The rules mirror the `diecast.models` CHECK constraints (docs/SCHEMA.md §4.1), so a
// form that validates here is one the database accepts; the database still re-checks everything.
import type {LookupInput, ModelSavePayload} from "../services/model-admin.ts";
import type {Category, Driver, LookupRef, Model, ModelSummary} from "../services/types.ts";
import {CONDITION_LABELS, formatAddedDate} from "./model-details.ts";
import {MAX_IMAGES, toFormImages, type FormImage} from "./model-images.ts";
import {SLUG_PATTERN, slugify} from "./slug.ts";

// A picked brand / manufacturer / driver: an existing row, or a name typed into the picker that
// the save will create (`isNew`).
export type LookupChoice = {slug: string; name: string; isNew: boolean};

export type ModelFormValues = {
    name: string;
    year: string;
    brand: LookupChoice | null;
    manufacturer: LookupChoice | null;
    categorySlug: string;
    scale: string;
    // Filter colors (`model_colors`), 1–3, in order.
    colorSlugs: string[];
    // The card/detail swatch (`models.livery_hex`), 0–8 `#RRGGBB`, in order (conic slices).
    liveryHex: string[];
    series: string;
    isRacing: boolean;
    carNumber: string;
    driver: LookupChoice | null;
    team: string;
    event: string;
    condition: string;
    addedAt: string;
    location: string;
    // Phase 26. The description is markdown-lite source (src/utils/markdown-lite.ts), stored as typed.
    description: string;
    // Ordered bullet points; blank rows are the owner's unfinished input and are dropped on save.
    keyFeatures: string[];
    tags: LookupChoice[];
    // Admin-only (`model_private_notes`); never shown to visitors.
    notes: string;
    // Phase 27. The photo list in gallery order — the first is the main photo. New photos are held
    // in the browser (already resized) and uploaded when the form is saved.
    images: FormImage[];
    // New models only; stable after creation. `slugEdited` = the owner typed their own, so it no
    // longer follows the generated one.
    slug: string;
    slugEdited: boolean;
};

export type ModelFormField = Exclude<keyof ModelFormValues, "slugEdited" | "isRacing">;
export type ModelFormErrors = Partial<Record<ModelFormField, string>>;

export const MAX_COLORS = 3;
export const MAX_LIVERY = 8;
export const MAX_KEY_FEATURES = 12;
export const MAX_TAGS = 20;
export const MIN_YEAR = 1885;
export const CONDITION_OPTIONS = Object.keys(CONDITION_LABELS);
// Common diecast scales for the picker; any `1:N` already stored is kept as an option too.
export const SCALE_OPTIONS = ["1:12", "1:18", "1:24", "1:32", "1:36", "1:43", "1:64", "1:87"];
export const DEFAULT_SCALE = "1:43";
// A new swatch before the owner picks its color (livery data, not UI styling): neutral mid-gray.
export const NEW_SWATCH_HEX = "#808080";

const LIMITS = {
    name: 120, team: 120, event: 120, series: 120, location: 80, lookupName: 80, slug: 80,
    description: 10000, notes: 10000, keyFeature: 200, tagName: 40,
} as const;
const HEX_PATTERN = /^#[0-9A-F]{6}$/;
const CAR_NUMBER_PATTERN = /^[0-9A-Z]{1,4}$/;
const SCALE_PATTERN = /^1:[0-9]{1,3}$/;

// `today` is "YYYY-MM-DD" (the caller's local date) — a new model is added today unless changed.
export function emptyModelForm(today: string): ModelFormValues {
    return {
        name: "",
        year: "",
        brand: null,
        manufacturer: null,
        categorySlug: "",
        scale: DEFAULT_SCALE,
        colorSlugs: [],
        liveryHex: [],
        series: "",
        isRacing: false,
        carNumber: "",
        driver: null,
        team: "",
        event: "",
        condition: "",
        addedAt: today,
        location: "",
        description: "",
        keyFeatures: [],
        tags: [],
        notes: "",
        images: [],
        slug: "",
        slugEdited: false,
    };
}

// `notes` come from a separate, admin-only read (getPrivateNotes()).
export function modelToFormValues(model: Model, notes: string | null = null): ModelFormValues {
    const existing = (ref: {slug: string; name: string}): LookupChoice => ({slug: ref.slug, name: ref.name, isNew: false});
    return {
        name: model.name,
        year: String(model.year),
        brand: existing(model.brand),
        manufacturer: existing(model.manufacturer),
        categorySlug: model.category.slug,
        scale: model.scale,
        colorSlugs: model.colors.map((c) => c.slug),
        liveryHex: [...model.liveryHex],
        series: model.series ?? "",
        isRacing: model.isRacing,
        carNumber: model.carNumber ?? "",
        driver: model.driver ? existing(model.driver) : null,
        team: model.team ?? "",
        event: model.event ?? "",
        condition: model.condition ?? "",
        addedAt: model.addedAt ?? "",
        location: model.location ?? "",
        description: model.description ?? "",
        keyFeatures: [...model.keyFeatures],
        tags: model.tags.map(existing),
        notes: notes ?? "",
        images: toFormImages(model.images),
        slug: model.slug,
        slugEdited: true,
    };
}

// The legacy convention (docs/SCHEMA.md principle 1): `{brand}-{model}-{year}-{manufacturer}-{color}`,
// e.g. "ferrari-499p-2023-burago-red". The model name usually already starts with the brand
// ("Ferrari 499P"), which is then not repeated; the first (main) color is the color part.
export function generateModelSlug(parts: {name: string; year: string; brand: string | null; manufacturer: string | null; color: string | null}): string {
    const name = slugify(parts.name);
    const brand = parts.brand ? slugify(parts.brand) : "";
    const model = brand && name !== brand && !name.startsWith(`${brand}-`) ? [brand, name] : [name];
    return [...model, slugify(parts.year), parts.manufacturer ? slugify(parts.manufacturer) : "", parts.color ? slugify(parts.color) : ""]
        .filter(Boolean)
        .join("-");
}

// "#abc", "abc", "#AABBCC" → "#AABBCC"; anything else → null.
export function normalizeHex(value: string): string | null {
    const raw = value.trim().replace(/^#/, "").toUpperCase();
    const six = /^[0-9A-F]{3}$/.test(raw) ? raw.split("").map((c) => c + c).join("") : raw;
    return /^[0-9A-F]{6}$/.test(six) ? `#${six}` : null;
}

// The livery swatch the chosen colors suggest: each color's representative hex, in order ("Multi"
// has none and is skipped).
export function liveryFromColors(colorSlugs: string[], colors: {slug: string; hex: string | null}[]): string[] {
    return colorSlugs
        .map((slug) => colors.find((c) => c.slug === slug)?.hex ?? null)
        .filter((hex): hex is string => hex !== null)
        .slice(0, MAX_LIVERY);
}

function isValidDate(value: string): boolean {
    return formatAddedDate(value) !== null;
}

function checkLookup(choice: LookupChoice | null, missing: string, maxName: number = LIMITS.lookupName): string | undefined {
    if (!choice) return missing;
    if (!choice.isNew) return undefined;
    const name = choice.name.trim();
    if (name.length > maxName) return `Keep the name under ${maxName} characters.`;
    if (!choice.slug || !SLUG_PATTERN.test(choice.slug)) return "Use at least one letter or digit (A–Z, 0–9) in the name.";
    return undefined;
}

// Field → message for every problem, in plain words; empty = valid. `isNew` adds the slug checks.
export function validateModelForm(values: ModelFormValues, context: {isNew: boolean; currentYear: number}): ModelFormErrors {
    const errors: ModelFormErrors = {};
    const name = values.name.trim();
    if (!name) errors.name = "Enter the model name.";
    else if (name.length > LIMITS.name) errors.name = `Keep the name under ${LIMITS.name} characters.`;

    const year = values.year.trim();
    const maxYear = context.currentYear + 1;
    if (!year) errors.year = "Enter the year.";
    else if (!/^\d{4}$/.test(year) || Number(year) < MIN_YEAR || Number(year) > maxYear) {
        errors.year = `Enter a year between ${MIN_YEAR} and ${maxYear}.`;
    }

    const brand = checkLookup(values.brand, "Choose a brand.");
    if (brand) errors.brand = brand;
    const manufacturer = checkLookup(values.manufacturer, "Choose a manufacturer.");
    if (manufacturer) errors.manufacturer = manufacturer;
    if (!values.categorySlug) errors.categorySlug = "Choose a category.";
    if (!SCALE_PATTERN.test(values.scale)) errors.scale = "Choose a scale like 1:43.";

    if (values.colorSlugs.length === 0) errors.colorSlugs = "Choose at least one color.";
    else if (values.colorSlugs.length > MAX_COLORS) errors.colorSlugs = `Choose at most ${MAX_COLORS} colors.`;

    if (values.liveryHex.length > MAX_LIVERY) errors.liveryHex = `Use at most ${MAX_LIVERY} swatch colors.`;
    else if (values.liveryHex.some((hex) => !HEX_PATTERN.test(hex))) errors.liveryHex = "Every swatch color must be a #RRGGBB value.";

    if (values.series.trim().length > LIMITS.series) errors.series = `Keep it under ${LIMITS.series} characters.`;

    if (values.isRacing) {
        const number = values.carNumber.trim().toUpperCase();
        if (number && !CAR_NUMBER_PATTERN.test(number)) errors.carNumber = "Use up to 4 letters or digits, e.g. 7, 07 or 3A.";
        if (values.driver) {
            const driver = checkLookup(values.driver, "");
            if (driver) errors.driver = driver;
        }
        if (values.team.trim().length > LIMITS.team) errors.team = `Keep it under ${LIMITS.team} characters.`;
        if (values.event.trim().length > LIMITS.event) errors.event = `Keep it under ${LIMITS.event} characters.`;
    }

    if (values.condition && !CONDITION_OPTIONS.includes(values.condition)) errors.condition = "Choose a condition from the list.";
    if (values.addedAt && !isValidDate(values.addedAt)) errors.addedAt = "Enter a real date.";
    if (values.location.trim().length > LIMITS.location) errors.location = `Keep it under ${LIMITS.location} characters.`;

    if (values.description.trim().length > LIMITS.description) {
        errors.description = `Keep the description under ${LIMITS.description.toLocaleString("en")} characters.`;
    }
    const features = cleanKeyFeatures(values.keyFeatures);
    if (features.length > MAX_KEY_FEATURES) errors.keyFeatures = `Use at most ${MAX_KEY_FEATURES} key features.`;
    else if (features.some((f) => f.length > LIMITS.keyFeature)) errors.keyFeatures = `Keep each key feature under ${LIMITS.keyFeature} characters.`;
    if (values.tags.length > MAX_TAGS) errors.tags = `Use at most ${MAX_TAGS} tags.`;
    else {
        const tagError = values.tags.map((t) => checkLookup(t, "", LIMITS.tagName)).find(Boolean);
        if (tagError) errors.tags = tagError;
    }
    if (values.notes.trim().length > LIMITS.notes) errors.notes = `Keep the notes under ${LIMITS.notes.toLocaleString("en")} characters.`;
    if (values.images.length > MAX_IMAGES) errors.images = `Use at most ${MAX_IMAGES} photos — remove ${values.images.length - MAX_IMAGES}.`;

    if (context.isNew) {
        const slug = values.slug.trim();
        if (!slug) errors.slug = "The address is generated from the name, year, brand, manufacturer and color — fill those in first.";
        else if (!SLUG_PATTERN.test(slug)) errors.slug = "Use lowercase letters, digits and single hyphens only.";
        else if (slug.length > LIMITS.slug) errors.slug = `Keep the address under ${LIMITS.slug} characters — shorten it by hand.`;
    }

    return errors;
}

// Order the form reports/focuses errors in — top to bottom as rendered.
export const FIELD_ORDER: ModelFormField[] = [
    "name", "year", "brand", "manufacturer", "categorySlug", "scale", "colorSlugs", "liveryHex", "series",
    "carNumber", "driver", "team", "event", "condition", "addedAt", "location", "description", "keyFeatures",
    "notes", "images", "tags", "slug",
];

export function firstErrorField(errors: ModelFormErrors): ModelFormField | undefined {
    return FIELD_ORDER.find((field) => errors[field]);
}

const orNull = (value: string) => value.trim() || null;

function lookupInput(choice: LookupChoice): LookupInput {
    return choice.isNew ? {slug: choice.slug, name: choice.name.trim(), create: true} : {slug: choice.slug, name: choice.name};
}

// Valid form values → what save_model() stores — except the photos: new ones must be uploaded
// first, so saveModelWithImages() (services/model-images.ts) adds the `images` key. Racing details only for racing models: turning
// "This is a racing model" off clears them (the form keeps them until save, so toggling back
// restores what was typed).
export function toSavePayload(values: ModelFormValues, isPublished: boolean): ModelSavePayload {
    if (!values.brand || !values.manufacturer) throw new Error("toSavePayload: validate the form first");
    return {
        slug: values.slug.trim(),
        name: values.name.trim(),
        year: Number(values.year.trim()),
        brand: lookupInput(values.brand),
        manufacturer: lookupInput(values.manufacturer),
        category_slug: values.categorySlug,
        scale: values.scale,
        livery_hex: values.liveryHex.map((hex) => hex.toUpperCase()),
        color_slugs: [...values.colorSlugs],
        is_racing: values.isRacing,
        car_number: values.isRacing ? orNull(values.carNumber.toUpperCase()) : null,
        driver: values.isRacing && values.driver ? lookupInput(values.driver) : null,
        team: values.isRacing ? orNull(values.team) : null,
        event: values.isRacing ? orNull(values.event) : null,
        series: orNull(values.series),
        condition: values.condition || null,
        location: orNull(values.location),
        added_at: values.addedAt || null,
        is_published: isPublished,
        description: values.description.trim() || null,
        key_features: cleanKeyFeatures(values.keyFeatures),
        tags: values.tags.map(lookupInput),
        notes: values.notes.trim() || null,
    };
}

export function cleanKeyFeatures(features: string[]): string[] {
    return features.map((f) => f.trim()).filter(Boolean);
}

// Unsaved changes = anything differs from what the form started with.
export function isFormDirty(initial: ModelFormValues, current: ModelFormValues): boolean {
    return JSON.stringify(initial) !== JSON.stringify(current);
}

// "YYYY-MM-DD" in the browser's own time zone (an `<input type="date">` value).
export function localDateString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---- completeness checklist (Phase 26, mockup "Checklist") -------------------------------------

export type ChecklistItem = {key: string; label: string; done: boolean; recommended?: boolean};

// What a finished model has. Required items mirror validation; the main image is any photo in the
// list (the first one is the main photo), and the description is recommended, not required — 227
// imported models have none.
export function getChecklist(values: ModelFormValues, context: {currentYear: number}): ChecklistItem[] {
    const errors = validateModelForm(values, {isNew: false, currentYear: context.currentYear});
    return [
        {key: "name", label: "Model name", done: !errors.name},
        {key: "brand", label: "Brand", done: !errors.brand},
        {key: "manufacturer", label: "Manufacturer", done: !errors.manufacturer},
        {key: "year", label: "Year", done: !errors.year},
        {key: "category", label: "Category", done: !errors.categorySlug},
        {key: "scale", label: "Scale", done: !errors.scale},
        {key: "color", label: "Color", done: !errors.colorSlugs},
        {key: "image", label: "Main image", done: values.images.length > 0},
        {key: "description", label: "Description", done: values.description.trim().length > 0, recommended: true},
    ];
}

// ---- live preview (Phase 26): the real ModelCard, fed from the form ----------------------------

export type PreviewContext = {
    slug: string;
    brands: LookupRef[];
    manufacturers: LookupRef[];
    categories: Category[];
    drivers: Driver[];
    colors: {slug: string; name: string}[];
};

// A ModelSummary built from the form as it stands, so the preview is the collection card itself.
// Missing values show their field name ("Brand", "Category"…) instead of inventing data.
export function toPreviewSummary(values: ModelFormValues, context: PreviewContext): ModelSummary {
    const ref = (choice: LookupChoice | null, list: LookupRef[], placeholder: string): LookupRef =>
        choice
            ? list.find((r) => r.slug === choice.slug) ?? {slug: choice.slug, name: choice.name, logoPath: null}
            : {slug: "", name: placeholder, logoPath: null};
    const year = /^\d{4}$/.test(values.year.trim()) ? Number(values.year.trim()) : 0;
    const category = context.categories.find((c) => c.slug === values.categorySlug) ?? {slug: "", name: "Category", sortOrder: 0};
    const driver = values.isRacing && values.driver
        ? context.drivers.find((d) => d.slug === values.driver!.slug) ?? {slug: values.driver.slug, name: values.driver.name, countryCode: null}
        : null;
    const number = values.carNumber.trim().toUpperCase();

    return {
        id: "preview",
        slug: context.slug || "preview",
        name: values.name.trim() || "Model name",
        year,
        scale: values.scale,
        isRacing: values.isRacing,
        carNumber: values.isRacing && number ? number : null,
        liveryHex: values.liveryHex,
        team: null,
        event: null,
        series: null,
        condition: null,
        location: null,
        addedAt: null,
        createdAt: "",
        updatedAt: "",
        brand: ref(values.brand, context.brands, "Brand"),
        manufacturer: ref(values.manufacturer, context.manufacturers, "Manufacturer"),
        category,
        driver,
        colors: values.colorSlugs.map((slug) => ({slug, name: context.colors.find((c) => c.slug === slug)?.name ?? slug})),
        image: previewImage(values.images[0]),
        imageCount: values.images.length,
    };
}

// The main photo as the card shows it: a new photo's resized preview, or the stored one.
function previewImage(image: FormImage | undefined): ModelSummary["image"] {
    if (!image) return null;
    if (image.kind === "new") return {url: image.previewUrl, thumbUrl: image.thumbPreviewUrl, width: image.full.width, height: image.full.height};
    return {url: image.url, thumbUrl: image.thumbUrl, width: image.width, height: image.height};
}
