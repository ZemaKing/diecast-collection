// Pure logic behind the model details page (ROADMAP Phase 19): which tabs a model actually has
// data for, which spec rows to show, and how the public "My Collection" fields read. Nothing here
// invents content — every row/tab is derived from a field that is set, or it isn't rendered.
import type {Model} from "../services/types.ts";

export const DETAIL_TABS = ["overview", "specifications", "gallery", "collection"] as const;

export type DetailTab = (typeof DETAIL_TABS)[number];

// "Notes" from the mockup is deliberately absent: the only notes are admin-private
// (`model_private_notes`, docs/SCHEMA.md §4.8) and there is no public source to show.
const TAB_LABELS: Record<DetailTab, string> = {
    overview: "Overview",
    specifications: "Specifications",
    gallery: "Gallery",
    collection: "My Collection",
};

export function tabLabel(tab: DetailTab, model: Pick<Model, "images">): string {
    return tab === "gallery" ? `${TAB_LABELS.gallery} (${model.images.length})` : TAB_LABELS[tab];
}

export function hasOverview(model: Pick<Model, "description" | "keyFeatures" | "tags">): boolean {
    return !!model.description?.trim() || model.keyFeatures.length > 0 || model.tags.length > 0;
}

// Specifications is always present — it is the full fact sheet, so even a model with nothing
// beyond the core fields has one meaningful section. The primary image is already shown at the
// top of the page, so Gallery only earns a tab once there's more than one image.
export function getAvailableTabs(model: Model): DetailTab[] {
    const tabs: DetailTab[] = [];
    if (hasOverview(model)) tabs.push("overview");
    tabs.push("specifications");
    if (model.images.length > 1) tabs.push("gallery");
    if (getCollectionFacts(model).length > 0) tabs.push("collection");
    return tabs;
}

// `?tab=` from the URL is untrusted: an unknown value, or a tab this model has no data for (an old
// link after the data changed), falls back to the first available tab rather than an empty panel.
export function resolveTab(raw: string | null, available: readonly DetailTab[]): DetailTab {
    const match = available.find((tab) => tab === raw);
    return match ?? available[0] ?? "specifications";
}

export type SpecRow = {label: string; value: string};

// Racing rows only for racing models, and only the fields that are set (audit D7: any
// combination of number/driver/team/series/event can be missing).
export function getRacingSpecs(model: Pick<Model, "isRacing" | "carNumber" | "driver" | "team" | "series" | "event">): SpecRow[] {
    if (!model.isRacing) return [];

    const rows: SpecRow[] = [];
    if (model.carNumber) rows.push({label: "Car number", value: `#${model.carNumber}`});
    if (model.driver) rows.push({label: "Driver", value: model.driver.name});
    if (model.team?.trim()) rows.push({label: "Team", value: model.team.trim()});
    if (model.series?.trim()) rows.push({label: "Series", value: model.series.trim()});
    if (model.event?.trim()) rows.push({label: "Event", value: model.event.trim()});
    return rows;
}

export function formatColors(model: Pick<Model, "colors">): string | null {
    return model.colors.length > 0 ? model.colors.map((c) => c.name).join(" / ") : null;
}

// Values are the `models.condition` check constraint (docs/SCHEMA.md §4.1).
const CONDITION_LABELS: Record<string, string> = {
    mint: "Mint",
    near_mint: "Near Mint",
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
};

export function formatCondition(condition: string): string {
    return CONDITION_LABELS[condition] ?? condition;
}

// Fixed abbreviations rather than Intl: en-GB renders September as "Sept" in current ICU data, and
// the output shouldn't depend on the browser's locale tables.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// `added_at` is a plain `date` ("2025-04-12") — no time, so no time zone to shift the day.
// "12 Apr 2025", as in the mockup.
export function formatAddedDate(date: string): string | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return null;

    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const parsed = new Date(Date.UTC(year, month - 1, day));
    // Date.UTC rolls "2025-13-45" over into a real date instead of failing — reject that.
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;

    return `${day} ${MONTHS[month - 1]} ${year}`;
}

// The public "My Collection" fields decided in Phase 4 (condition, added date, location). There
// is no "Collected" status — every model in the collection is owned (docs/SCHEMA.md, decisions).
export function getCollectionFacts(model: Pick<Model, "addedAt" | "condition" | "location">): SpecRow[] {
    const rows: SpecRow[] = [];
    const added = model.addedAt ? formatAddedDate(model.addedAt) : null;
    if (added) rows.push({label: "Added", value: added});
    if (model.condition) rows.push({label: "Condition", value: formatCondition(model.condition)});
    if (model.location?.trim()) rows.push({label: "Location", value: model.location.trim()});
    return rows;
}
