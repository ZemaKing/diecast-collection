// Image URL resolution (ROADMAP Phase 20, docs/SCHEMA.md §4 "URL resolution"): the one place that
// turns an image's storage columns into a URL the browser can load. Today every image is an
// external postimg.cc URL; from Phase 21 images move into Supabase Storage and rows get a
// `storage_path` instead — this prefers that, and nothing else in the app has to change.

// Public-read bucket (Phase 21): `models/{slug}/{position}-{full|thumb}.webp|png`.
export const MODEL_IMAGES_BUCKET = "model-images";

export type ImageSource = {
    storagePath: string | null | undefined;
    externalUrl: string | null | undefined;
};

// `https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>` — each path segment is
// encoded, the separators are kept. An already-absolute storage path is passed through.
export function publicStorageUrl(projectUrl: string, path: string, bucket = MODEL_IMAGES_BUCKET): string {
    if (/^https?:\/\//i.test(path)) return path;
    const base = projectUrl.trim().replace(/\/+$/, "");
    const key = path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
    return `${base}/storage/v1/object/public/${bucket}/${key}`;
}

// Storage wins over the external URL (the row may carry both mid-migration). Without a project
// URL a storage path can't be resolved, so it falls back to the external URL rather than
// emitting a relative path that 404s.
export function resolveImageUrl({storagePath, externalUrl}: ImageSource, projectUrl: string = supabaseProjectUrl()): string | null {
    const path = storagePath?.trim();
    if (path && projectUrl) return publicStorageUrl(projectUrl, path);
    return externalUrl?.trim() || null;
}

// Read at call time (not import time) so it never throws: src/lib/env.ts is what validates it.
// `import.meta.env` is undefined outside Vite (tsx scripts), hence the optional chaining.
function supabaseProjectUrl(): string {
    return import.meta.env?.VITE_SUPABASE_URL?.trim() ?? "";
}
