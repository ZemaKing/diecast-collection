// Domain types for the Supabase-backed collection (Phase 9). Components consume these, never
// database.types.ts Row shapes directly — src/services/mappers.ts is the only place that converts
// between them. See docs/SCHEMA.md for the underlying tables/views.

export type LookupRef = {
    slug: string;
    name: string;
    logoPath: string | null;
};

export type Category = {
    slug: string;
    name: string;
    sortOrder: number;
};

export type Driver = {
    slug: string;
    name: string;
    countryCode: string | null;
};

export type ModelColor = {
    slug: string;
    name: string;
};

export type Tag = {
    slug: string;
    name: string;
};

export type ModelImage = {
    id: string;
    position: number;
    isPrimary: boolean;
    url: string | null;
    thumbUrl: string | null;
    width: number | null;
    height: number | null;
};

// One row per model — everything the collection grid/toolbar/filters need. Backed by
// `diecast.model_summaries` (already joins brand/manufacturer/category/driver/colors and picks
// the primary image), read-only.
export type ModelSummary = {
    id: string;
    slug: string;
    name: string;
    year: number;
    scale: string;
    isRacing: boolean;
    carNumber: string | null;
    liveryHex: string[];
    team: string | null;
    event: string | null;
    series: string | null;
    condition: string | null;
    location: string | null;
    addedAt: string | null;
    createdAt: string;
    updatedAt: string;
    brand: LookupRef;
    manufacturer: LookupRef;
    category: Category;
    driver: Driver | null;
    colors: ModelColor[];
    image: {url: string | null; thumbUrl: string | null; width: number | null; height: number | null} | null;
    imageCount: number;
};

// Everything the details page (Phase 19) and admin form (Phase 25) need beyond the summary:
// description/key features/tags (not exposed by model_summaries), publish state, and the full
// gallery.
export type Model = Omit<ModelSummary, "image" | "imageCount"> & {
    description: string | null;
    keyFeatures: string[];
    tags: Tag[];
    isPublished: boolean;
    images: ModelImage[];
};

export type CollectionStats = {
    totalModels: number;
    totalBrands: number;
    totalManufacturers: number;
    totalCategories: number;
    // Distinct scales, sorted (e.g. ["1:43"]) — the hero says "1:43 scale models" only while
    // there's exactly one.
    scales: string[];
};
