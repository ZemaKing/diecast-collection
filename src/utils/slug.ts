// "Citroën" → "citroen", "Leo Models" → "leo-models", "Off-Road" → "off-road".
// Matches the DB slug CHECK: ^[a-z0-9]+(-[a-z0-9]+)*$. Returns "" when nothing ASCII survives,
// so callers can detect names that need a manual slug.
export function slugify(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/ß/g, "ss")
        .replace(/[łŁ]/g, "l")
        .replace(/[øØ]/g, "o")
        .replace(/[æÆ]/g, "ae")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
