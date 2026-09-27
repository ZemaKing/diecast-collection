import {slugify} from "./slug.ts";

// "Off-Road" → "off-road", "Rally" → "rally". Matches the `--cat-<slug>` tokens in styles.css
// and the `categories.slug` column.
export function categorySlug(category: string): string {
    return slugify(category);
}

// Unknown categories fall back to a neutral token instead of rendering uncolored.
export function categoryColorVar(category: string): string {
    return `var(--cat-${categorySlug(category)}, var(--cat-fallback))`;
}
