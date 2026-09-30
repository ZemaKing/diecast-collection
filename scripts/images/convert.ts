// Image conversion (sharp) and checksums.
import {createHash} from "node:crypto";
import sharp from "sharp";

import {PermanentError} from "./retry.ts";
import type {Variant} from "./types.ts";

export const OUTPUT_EXT = "webp";
export const OUTPUT_CONTENT_TYPE = "image/webp";

export type ImageInfo = {width: number; height: number; format: string};
export type Converted = {data: Buffer; width: number; height: number; bytes: number; sha256: string};

export const sha256 = (data: Buffer | Uint8Array): string => createHash("sha256").update(data).digest("hex");

// Identifies a variant's output settings. A manifest entry made with other settings is redone.
export function variantSettings(variant: Variant): string {
    const {name, maxWidth, maxHeight = maxWidth, quality} = variant;
    return `${name}:${OUTPUT_EXT}:${maxWidth}x${maxHeight}:q${quality}`;
}

export async function readImageInfo(data: Buffer): Promise<ImageInfo> {
    try {
        const meta = await sharp(data).metadata();
        if (!meta.width || !meta.height || !meta.format) throw new Error("no dimensions");
        // EXIF orientations 5–8 swap width and height once rotated.
        const swap = (meta.orientation ?? 1) >= 5;
        return {width: swap ? meta.height : meta.width, height: swap ? meta.width : meta.height, format: meta.format};
    } catch (error) {
        throw new PermanentError(`Not a readable image (${error instanceof Error ? error.message : String(error)}).`);
    }
}

export async function convertVariant(input: Buffer, variant: Variant): Promise<Converted> {
    const {data, info} = await sharp(input, {failOn: "error"})
        .rotate()
        .resize({width: variant.maxWidth, height: variant.maxHeight ?? variant.maxWidth, fit: "inside", withoutEnlargement: true})
        .webp({quality: variant.quality, effort: 6})
        .toBuffer({resolveWithObject: true});
    return {data, width: info.width, height: info.height, bytes: data.length, sha256: sha256(data)};
}
