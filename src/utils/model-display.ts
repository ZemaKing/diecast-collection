// Small display helpers shared by every collection view (grid card, list row, compact row).

export const countryCodeToFlagEmoji = (countryCode: string) =>
    countryCode
        .toUpperCase()
        .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

// `logo_path` values (from the importer) are exact filenames on disk, e.g. "/brands/Aston
// Martin.svg" — encodeURI so the space (or any other special character) round-trips in <img src>.
export function logoSrc(logoPath: string | null): string | null {
    return logoPath ? encodeURI(logoPath) : null;
}
