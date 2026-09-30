// Pure logic behind the model gallery and lightbox (ROADMAP Phase 20). All index math wraps, so
// prev on the first photo goes to the last — and a single-photo gallery is simply "always 0".
import type {ModelImage} from "../services/types.ts";

// The photos that can actually be shown, in position order (getModelBySlug() already sorts).
// A row with neither a full nor a thumbnail URL can't render anything, so it isn't counted
// in "1 / n" either.
export function displayableImages(images: readonly ModelImage[]): ModelImage[] {
    return images.filter((image) => !!(image.url ?? image.thumbUrl));
}

// The gallery opens on the primary photo, wherever it sits in the order.
export function primaryIndex(images: readonly Pick<ModelImage, "isPrimary">[]): number {
    const index = images.findIndex((image) => image.isPrimary);
    return index === -1 ? 0 : index;
}

export function wrapIndex(index: number, count: number): number {
    if (count <= 0) return 0;
    return ((index % count) + count) % count;
}

// The photos either side of `index` — preloaded by the lightbox so prev/next is instant. No
// duplicates (with 2 photos both neighbours are the same one) and never the current photo.
export function neighborIndexes(index: number, count: number): number[] {
    if (count <= 1) return [];
    const next = wrapIndex(index + 1, count);
    const prev = wrapIndex(index - 1, count);
    return next === prev ? [next] : [next, prev];
}

// Full size for the main view / lightbox, falling back to the thumbnail (and vice versa).
export function fullSrc(image: Pick<ModelImage, "url" | "thumbUrl">): string | null {
    return image.url ?? image.thumbUrl;
}

export function thumbSrc(image: Pick<ModelImage, "url" | "thumbUrl">): string | null {
    return image.thumbUrl ?? image.url;
}

export function counterLabel(index: number, count: number): string {
    return `${wrapIndex(index, count) + 1} / ${count}`;
}

// Owner-written alt text wins; otherwise describe the photo from the model's own facts.
export function imageAlt(image: Pick<ModelImage, "alt">, modelLabel: string, index: number, count: number): string {
    if (image.alt) return image.alt;
    return count > 1 ? `${modelLabel}, photo ${index + 1} of ${count}` : modelLabel;
}

export type SwipeDirection = "next" | "prev" | null;

// Touch swipe from a pointerdown → pointerup delta: a mostly-horizontal move of at least
// `threshold` px. Swiping left (negative dx) reveals the next photo, like every photo app.
export function swipeDirection(dx: number, dy: number, threshold = 48): SwipeDirection {
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
    return dx < 0 ? "next" : "prev";
}
