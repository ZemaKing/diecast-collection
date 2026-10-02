// Small display helpers shared by every collection view (grid card, list row, compact row).
import {resolveLogoUrl} from "../services/image-url.ts";

export const countryCodeToFlagEmoji = (countryCode: string) =>
    countryCode
        .toUpperCase()
        .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

// A brand/manufacturer logo's URL: a file in public/ or an uploaded logo in Storage (Phase 28).
export function logoSrc(logoPath: string | null): string | null {
    return resolveLogoUrl(logoPath);
}
