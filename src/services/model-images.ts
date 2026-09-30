// Saving a model together with its photos (ROADMAP Phase 27). Storage isn't transactional, so the
// order is what keeps it free of orphans and lost photos:
//   1. upload the new photos (fresh file names under models/{slug}/ — nothing existing is touched);
//   2. save_model() writes the model AND the photo list in one transaction;
//      if it fails, the files from step 1 are removed again;
//   3. only after the commit, the files of the photos the save dropped are removed (best effort —
//      a failure there is reported as orphaned files, the save itself stands).
import {toAppError, type AppError} from "../lib/errors.ts";
import {supabase} from "../lib/supabase.ts";
import {imageStoragePath, toImagesPayload, type FormImage, type NewFormImage, type PreparedVariant, type UploadedImage} from "../utils/model-images.ts";

import {MODEL_IMAGES_BUCKET} from "./image-url.ts";
import {removeStorageFiles, saveModel, type ModelSavePayload, type SaveModelResult} from "./model-admin.ts";

// Same caching as the Phase 21 migration (a week) — which is why photos get new names, never overwrites.
const CACHE_CONTROL = "604800";

export type UploadProgress = {done: number; total: number};

export type SaveWithImagesResult = SaveModelResult & {
    // Files of removed photos that couldn't be deleted from Storage (the save succeeded regardless).
    orphanedFiles: string[];
};

async function uploadVariant(path: string, variant: PreparedVariant): Promise<void> {
    const {error} = await supabase.storage
        .from(MODEL_IMAGES_BUCKET)
        .upload(path, variant.blob, {contentType: variant.type, cacheControl: CACHE_CONTROL, upsert: false});
    if (error) throw error;
}

function uploadError(error: unknown, image: NewFormImage): AppError {
    const appError = toAppError(error);
    const raw = (error as {message?: unknown} | null)?.message;
    // The bucket comes from migration 20260930120000 (Phase 21); say so rather than "invalid data".
    if (typeof raw === "string" && /bucket not found/i.test(raw)) {
        return {...appError, kind: "config", retryable: false, message: "Photo storage isn't set up yet — the Storage migration (20260930120000) hasn't been applied."};
    }
    return {...appError, message: `Couldn't upload “${image.fileName}”: ${appError.message}`};
}

// Uploads both sizes of every new photo, one photo at a time (they're small after resizing). On a
// failure, whatever this call already uploaded is removed again and the error is thrown.
export async function uploadNewImages(
    slug: string,
    images: NewFormImage[],
    onProgress?: (progress: UploadProgress) => void,
): Promise<Map<string, UploadedImage>> {
    const uploaded = new Map<string, UploadedImage>();
    const written: string[] = [];
    onProgress?.({done: 0, total: images.length});
    for (const image of images) {
        const storagePath = imageStoragePath(slug, image.key, "full", image.full.ext);
        const thumbStoragePath = imageStoragePath(slug, image.key, "thumb", image.thumb.ext);
        try {
            await uploadVariant(storagePath, image.full);
            written.push(storagePath);
            await uploadVariant(thumbStoragePath, image.thumb);
            written.push(thumbStoragePath);
        } catch (error) {
            await removeStorageFiles(written);
            throw uploadError(error, image);
        }
        uploaded.set(image.key, {storagePath, thumbStoragePath, width: image.full.width, height: image.full.height});
        onProgress?.({done: uploaded.size, total: images.length});
    }
    return uploaded;
}

// `images` undefined = the photos aren't part of this save (left exactly as they are).
export async function saveModelWithImages(
    payload: ModelSavePayload,
    images: FormImage[] | undefined,
    options: {originalSlug?: string | null; onProgress?: (progress: UploadProgress) => void} = {},
): Promise<SaveWithImagesResult> {
    if (!images) return {...(await saveModel(payload, {originalSlug: options.originalSlug})), orphanedFiles: []};

    // The folder is the model's address — fixed after creation, so the original one when editing.
    const slug = options.originalSlug ?? payload.slug;
    const newImages = images.filter((i): i is NewFormImage => i.kind === "new");
    const uploaded = await uploadNewImages(slug, newImages, options.onProgress);

    let result: SaveModelResult;
    try {
        result = await saveModel({...payload, images: toImagesPayload(images, uploaded)}, {originalSlug: options.originalSlug});
    } catch (error) {
        await removeStorageFiles([...uploaded.values()].flatMap((u) => [u.storagePath, u.thumbStoragePath]));
        throw toAppError(error);
    }
    return {...result, orphanedFiles: await removeStorageFiles(result.removedFiles)};
}
