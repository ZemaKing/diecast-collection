// Small display helpers shared by every collection view (grid card, list row, compact row).
import {resolveLogoUrl} from "../services/image-url.ts";
import type {ModelSummary} from "../services/types.ts";

export const countryCodeToFlagEmoji = (countryCode: string) =>
    countryCode
        .toUpperCase()
        .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

// A brand/manufacturer logo's URL: a file in public/ or an uploaded logo in Storage (Phase 28).
export function logoSrc(logoPath: string | null): string | null {
    return resolveLogoUrl(logoPath);
}

// Photo loading in a collection list (Phase 33): the first row's photos load at once and at high
// priority — the largest of them is the page's LCP — and everything else stays lazy. Four covers
// the first row on a phone (1 column) through a 1280px desktop; a wider screen's extra columns
// just load lazily (they're still in view, so the browser fetches them right away).
export const PRIORITY_IMAGE_COUNT = 4;

export function photoLoading(priority: boolean): {loading: "eager" | "lazy"; fetchPriority: "high" | "auto"} {
    return priority ? {loading: "eager", fetchPriority: "high"} : {loading: "lazy", fetchPriority: "auto"};
}

type LinkLabelFields = Pick<ModelSummary, "name" | "year" | "scale" | "carNumber"> & {
    brand: {name: string};
    manufacturer: {name: string};
    category: {name: string};
    driver: {name: string} | null;
};

// The accessible name of a model's card / list row / compact row link (Phase 34): the model name
// first (what's visible and what a voice user says), then the facts in reading order. Without it the
// link's name was its whole content — photo alt, logo alts and badges — with the name twice.
export function modelLinkLabel(model: LinkLabelFields): string {
    return [
        model.name,
        model.year > 0 ? String(model.year) : null,
        model.brand.name,
        model.manufacturer.name,
        model.category.name,
        model.carNumber !== null ? `#${model.carNumber}` : null,
        model.driver?.name ?? null,
        model.scale,
    ].filter((part): part is string => !!part?.trim()).join(", ");
}
