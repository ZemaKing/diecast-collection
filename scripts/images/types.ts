// Types for the reusable image pipeline (ROADMAP Phase 21). Nothing in scripts/images/ knows about
// the app that uses it: an app describes its images as an ImageJob (see README.md) and runs the CLI.
import type {SupabaseClient} from "@supabase/supabase-js";

// One output size. Every variant is WebP, resized to fit inside maxWidth × maxHeight (never
// enlarged), EXIF-rotated and stripped of metadata.
export type Variant = {
    name: string; // fills {variant} in the path pattern, e.g. "full" | "thumb"
    maxWidth: number;
    maxHeight?: number; // default: maxWidth, i.e. the longest edge is bounded
    quality: number; // WebP quality, 1–100
};

// One original image to convert. `vars` fill the path pattern's placeholders.
export type ImageSource = {
    key: string; // unique and stable — used in logs, --only and the manifest
    url: string; // where the original is downloaded from
    vars: Record<string, string | number>;
};

export type ImageJob = {
    name: string;
    bucket: string;
    // Storage key per source × variant. Placeholders: {variant}, {ext} ("webp") + the source's vars.
    pathPattern: string;
    variants: Variant[];
    // Resume state + checksums (JSON). Rewritten after every source, so an interrupted run resumes.
    manifest: URL;
    cacheControl?: string; // seconds, default 604800 (a week)
    concurrency?: number; // default 4
    retries?: number; // default 4 (so up to 5 attempts per request)
    sources(supabase: SupabaseClient): Promise<ImageSource[]>;
};

// Where the converted files go. `supabaseTarget()` is the real one; tests use an in-memory fake.
export interface StorageTarget {
    stat(path: string): Promise<{size: number} | null>;
    upload(path: string, data: Buffer, options: {contentType: string; cacheControl: string}): Promise<void>;
    publicUrl(path: string): string;
}
