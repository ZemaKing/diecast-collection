// Pure logic behind the model form's Images section (ROADMAP Phase 27): which files are accepted,
// the ordered photo list (first = main photo) and its moves, Storage paths for new photos, and the
// `images` part of the save_model() payload. No React, no Supabase — unit-tested.
import type {ModelImage} from "../services/types.ts";

// Mockup: "PNG, JPG, WEBP (max 5MB)", "Additional Images (5/10)" — read as 10 photos in all.
export const MAX_IMAGES = 10;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
// The file picker's `accept` (types plus extensions, for pickers that go by extension).
export const IMAGE_ACCEPT = [...ACCEPTED_IMAGE_TYPES, ".png", ".jpg", ".jpeg", ".webp"].join(",");

// Same sizes as the Phase 21 batch converter (scripts/migrate-images/job.ts): the canvas quality
// scale is 0–1 where sharp's is 0–100.
export const IMAGE_VARIANTS = [
    {name: "full", maxWidth: 1600, quality: 0.82},
    {name: "thumb", maxWidth: 400, quality: 0.75},
] as const;

// A photo that already exists (a `model_images` row) — kept, moved or removed.
export type ExistingFormImage = {
    kind: "existing";
    id: string;
    url: string | null;
    thumbUrl: string | null;
    width: number | null;
    height: number | null;
    alt: string | null;
};

export type PreparedVariant = {blob: Blob; width: number; height: number; type: string; ext: "webp" | "png" | "jpg"};

// A photo picked in this session, resized in the browser, uploaded only when the form is saved.
// `previewUrl`/`thumbPreviewUrl` are object URLs of the resized blobs.
export type NewFormImage = {
    kind: "new";
    key: string;
    fileName: string;
    full: PreparedVariant;
    thumb: PreparedVariant;
    previewUrl: string;
    thumbPreviewUrl: string;
};

export type FormImage = ExistingFormImage | NewFormImage;

export function formImageKey(image: FormImage): string {
    return image.kind === "existing" ? image.id : image.key;
}

// The details page's photos → the form's list. The database keeps position 0 = primary since
// Phase 27; older data could in theory have the primary elsewhere, so it's put first here (saving
// then tidies the stored order to match).
export function toFormImages(images: ModelImage[]): ExistingFormImage[] {
    const ordered = [...images].sort((a, b) => a.position - b.position);
    const primary = ordered.findIndex((i) => i.isPrimary);
    if (primary > 0) ordered.unshift(...ordered.splice(primary, 1));
    return ordered.map((i) => ({kind: "existing", id: i.id, url: i.url, thumbUrl: i.thumbUrl, width: i.width, height: i.height, alt: i.alt}));
}

// Why a picked file can't be used, in plain words; null = fine. (The browser may report "" for the
// type of an unusual file, so the extension is the fallback.)
export function checkImageFile(file: {name: string; type: string; size: number}): string | null {
    const type = file.type || typeFromName(file.name);
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)) return `${file.name}: only PNG, JPG and WEBP photos can be added.`;
    if (file.size > MAX_IMAGE_BYTES) return `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_IMAGE_BYTES)}.`;
    if (file.size === 0) return `${file.name} is empty.`;
    return null;
}

function typeFromName(name: string): string {
    const ext = name.toLowerCase().split(".").pop();
    return ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "";
}

export function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
}

// Splits picked files into what fits (valid, within the remaining room) and messages for the rest.
export function pickImageFiles<F extends {name: string; type: string; size: number}>(files: F[], currentCount: number): {accepted: F[]; errors: string[]} {
    const accepted: F[] = [];
    const errors: string[] = [];
    let room = MAX_IMAGES - currentCount;
    let skipped = 0;
    for (const file of files) {
        const error = checkImageFile(file);
        if (error) errors.push(error);
        else if (room > 0) {
            accepted.push(file);
            room--;
        } else skipped++;
    }
    if (skipped > 0) errors.push(`${skipped === 1 ? "One photo was" : `${skipped} photos were`} left out — a model can have up to ${MAX_IMAGES}.`);
    return {accepted, errors};
}

// Moves the photo at `from` to `to` (clamped); a new array, the input untouched.
export function moveImage<T>(list: T[], from: number, to: number): T[] {
    if (from < 0 || from >= list.length) return list;
    const target = Math.max(0, Math.min(list.length - 1, to));
    if (target === from) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(target, 0, item);
    return next;
}

// "Set as main photo" = move it to the front.
export function makeMain<T>(list: T[], index: number): T[] {
    return moveImage(list, index, 0);
}

// A short random file name for a new photo (lowercase hex, matches the database's path check).
export function newImageKey(random: () => string = () => crypto.randomUUID()): string {
    return random().replace(/-/g, "").slice(0, 12).toLowerCase();
}

// `models/{slug}/{key}-{full|thumb}.{ext}` — a fresh name per upload (objects are cached for a week,
// Phase 21, so a photo is never overwritten in place).
export function imageStoragePath(slug: string, key: string, variant: "full" | "thumb", ext: string): string {
    return `models/${slug}/${key}-${variant}.${ext}`;
}

export type UploadedImage = {storagePath: string; thumbStoragePath: string; width: number; height: number};

export type ImagePayloadItem =
    | {id: string}
    | {storage_path: string; thumb_storage_path: string; width: number; height: number};

// The ordered list → save_model()'s `images` key. Every new photo must have been uploaded first.
export function toImagesPayload(images: FormImage[], uploaded: ReadonlyMap<string, UploadedImage> = new Map()): ImagePayloadItem[] {
    return images.map((image) => {
        if (image.kind === "existing") return {id: image.id};
        const done = uploaded.get(image.key);
        if (!done) throw new Error(`toImagesPayload: photo "${image.fileName}" hasn't been uploaded`);
        return {storage_path: done.storagePath, thumb_storage_path: done.thumbStoragePath, width: done.width, height: done.height};
    });
}

// The form's photos as the gallery/lightbox shape (for previewing before saving).
export function toPreviewImages(images: FormImage[]): ModelImage[] {
    return images.map((image, position) =>
        image.kind === "existing"
            ? {id: image.id, position, isPrimary: position === 0, url: image.url, thumbUrl: image.thumbUrl, width: image.width, height: image.height, alt: image.alt}
            : {id: image.key, position, isPrimary: position === 0, url: image.previewUrl, thumbUrl: image.thumbPreviewUrl, width: image.full.width, height: image.full.height, alt: null});
}

// Screen-reader / menu wording for a photo's place.
export function imageLabel(index: number, count: number): string {
    return index === 0 ? `Main photo (1 of ${count})` : `Photo ${index + 1} of ${count}`;
}
