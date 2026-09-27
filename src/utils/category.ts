// "Off-Road" → "off-road", "Rally" → "rally". Matches the `--cat-<slug>` tokens in styles.css
// and the planned `categories.slug` column.
export function categorySlug(category: string): string {
    return category
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// Unknown categories fall back to a neutral token instead of rendering uncolored.
export function categoryColorVar(category: string): string {
    return `var(--cat-${categorySlug(category)}, var(--cat-fallback))`;
}
