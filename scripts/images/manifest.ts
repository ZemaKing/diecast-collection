// The manifest records every uploaded object: where it came from, the settings used, and the
// checksum/size/dimensions of what was uploaded. It is what makes runs resumable (skip what's done)
// and verifiable (compare what Storage serves against the recorded sha256).
import {existsSync, readFileSync, renameSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

import {variantSettings} from "./convert.ts";
import type {ImageSource, Variant} from "./types.ts";

export type ManifestEntry = {
    source: string; // ImageSource.key
    sourceUrl: string;
    sourceSha256: string;
    sourceBytes: number;
    sourceWidth: number;
    sourceHeight: number;
    variant: string;
    settings: string; // variantSettings()
    contentType: string;
    sha256: string;
    bytes: number;
    width: number;
    height: number;
    uploadedAt: string;
};

export type Manifest = {
    job: string;
    bucket: string;
    objects: Record<string, ManifestEntry>; // keyed by storage path
};

export function emptyManifest(job: string, bucket: string): Manifest {
    return {job, bucket, objects: {}};
}

export function loadManifest(file: URL, job: string, bucket: string): Manifest {
    if (!existsSync(file)) return emptyManifest(job, bucket);
    const manifest = JSON.parse(readFileSync(file, "utf8")) as Manifest;
    if (manifest.bucket !== bucket) {
        throw new Error(`${fileURLToPath(file)} belongs to bucket "${manifest.bucket}", not "${bucket}".`);
    }
    return {...manifest, job};
}

// Sorted keys (stable diffs), written to a temp file and renamed (never a half-written manifest).
export function saveManifest(file: URL, manifest: Manifest): void {
    const objects = Object.fromEntries(Object.keys(manifest.objects).sort().map((k) => [k, manifest.objects[k]]));
    const tmp = new URL(`${file.href}.tmp`);
    writeFileSync(tmp, `${JSON.stringify({...manifest, objects}, null, 2)}\n`);
    renameSync(tmp, file);
}

// Done = uploaded from the same source URL with the same settings. (Whether the object is still in
// Storage is checked separately, only when uploading for real.)
export function isDone(manifest: Manifest, path: string, source: ImageSource, variant: Variant): boolean {
    const entry = manifest.objects[path];
    return !!entry && entry.sourceUrl === source.url && entry.settings === variantSettings(variant);
}
