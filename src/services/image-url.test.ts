import {describe, expect, it} from "vitest";

import {MODEL_IMAGES_BUCKET, publicStorageUrl, resolveImageUrl} from "./image-url.ts";

const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";

describe("publicStorageUrl", () => {
    it("builds the public object URL for the model-images bucket", () => {
        expect(MODEL_IMAGES_BUCKET).toBe("model-images");
        expect(publicStorageUrl(PROJECT, "models/abarth-124/0-full.webp")).toBe(
            `${PROJECT}/storage/v1/object/public/model-images/models/abarth-124/0-full.webp`,
        );
    });

    it("tolerates a trailing slash on the project URL and a leading slash on the path", () => {
        expect(publicStorageUrl(`${PROJECT}/`, "/models/a/0-thumb.png")).toBe(
            `${PROJECT}/storage/v1/object/public/model-images/models/a/0-thumb.png`,
        );
    });

    it("encodes each path segment but keeps the separators", () => {
        expect(publicStorageUrl(PROJECT, "models/a b/0#1.png")).toBe(
            `${PROJECT}/storage/v1/object/public/model-images/models/a%20b/0%231.png`,
        );
    });

    it("passes an already-absolute URL through", () => {
        expect(publicStorageUrl(PROJECT, "https://cdn.example.com/x.png")).toBe("https://cdn.example.com/x.png");
    });
});

describe("resolveImageUrl", () => {
    it("uses the external URL when there is no storage path (every image today)", () => {
        expect(resolveImageUrl({storagePath: null, externalUrl: "https://i.postimg.cc/a/b.png"}, PROJECT)).toBe("https://i.postimg.cc/a/b.png");
    });

    it("prefers the storage path when both are set (mid-migration)", () => {
        expect(resolveImageUrl({storagePath: "models/a/0-full.webp", externalUrl: "https://i.postimg.cc/a/b.png"}, PROJECT)).toBe(
            `${PROJECT}/storage/v1/object/public/model-images/models/a/0-full.webp`,
        );
    });

    it("falls back to the external URL when the project URL is unknown", () => {
        expect(resolveImageUrl({storagePath: "models/a/0-full.webp", externalUrl: "https://x.test/a.png"}, "")).toBe("https://x.test/a.png");
        expect(resolveImageUrl({storagePath: "models/a/0-full.webp", externalUrl: null}, "")).toBeNull();
    });

    it("returns null when there is nothing (blank values count as nothing)", () => {
        expect(resolveImageUrl({storagePath: null, externalUrl: null}, PROJECT)).toBeNull();
        expect(resolveImageUrl({storagePath: "  ", externalUrl: " "}, PROJECT)).toBeNull();
        expect(resolveImageUrl({storagePath: undefined, externalUrl: undefined}, PROJECT)).toBeNull();
    });
});
