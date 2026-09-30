import {describe, expect, it} from "vitest";

import type {ModelImage} from "../services/types.ts";
import {
    MAX_IMAGES,
    checkImageFile,
    formatBytes,
    imageLabel,
    imageStoragePath,
    makeMain,
    moveImage,
    newImageKey,
    pickImageFiles,
    toFormImages,
    toImagesPayload,
    toPreviewImages,
    type FormImage,
    type NewFormImage,
} from "./model-images.ts";

const MB = 1024 * 1024;
const file = (name: string, type: string, size = 200_000) => ({name, type, size});

const stored = (id: string, position: number, isPrimary = false): ModelImage =>
    ({id, position, isPrimary, url: `https://x.test/${id}.webp`, thumbUrl: `https://x.test/${id}-t.webp`, width: 1200, height: 800, alt: null});

const variant = (width: number, height: number) => ({blob: new Blob(["x"]), width, height, type: "image/webp", ext: "webp" as const});
const picked = (key: string): NewFormImage => ({
    kind: "new", key, fileName: `${key}.jpg`, full: variant(1600, 1000), thumb: variant(400, 250), previewUrl: `blob:${key}`, thumbPreviewUrl: `blob:${key}-t`,
});

describe("checkImageFile", () => {
    it("accepts PNG, JPG and WEBP up to 5 MB", () => {
        expect(checkImageFile(file("a.png", "image/png"))).toBeNull();
        expect(checkImageFile(file("a.jpg", "image/jpeg", 5 * MB))).toBeNull();
        expect(checkImageFile(file("a.webp", "image/webp"))).toBeNull();
    });

    it("falls back to the extension when the browser reports no type", () => {
        expect(checkImageFile(file("a.JPEG", ""))).toBeNull();
        expect(checkImageFile(file("a.heic", ""))).toMatch(/only PNG, JPG and WEBP/);
    });

    it("explains what's wrong, naming the file", () => {
        expect(checkImageFile(file("car.gif", "image/gif"))).toBe("car.gif: only PNG, JPG and WEBP photos can be added.");
        expect(checkImageFile(file("big.jpg", "image/jpeg", 5 * MB + 1))).toBe("big.jpg is 5 MB — the limit is 5 MB.");
        expect(checkImageFile(file("huge.jpg", "image/jpeg", 12.4 * MB))).toBe("huge.jpg is 12.4 MB — the limit is 5 MB.");
        expect(checkImageFile(file("empty.png", "image/png", 0))).toBe("empty.png is empty.");
    });
});

describe("formatBytes", () => {
    it("rounds to a readable unit", () => {
        expect(formatBytes(512)).toBe("512 B");
        expect(formatBytes(24_700)).toBe("24 KB");
        expect(formatBytes(1.5 * MB)).toBe("1.5 MB");
    });
});

describe("pickImageFiles", () => {
    it("keeps valid files up to the limit and says what was left out", () => {
        const files = [file("a.png", "image/png"), file("b.gif", "image/gif"), file("c.png", "image/png"), file("d.png", "image/png")];
        const {accepted, errors} = pickImageFiles(files, MAX_IMAGES - 2);
        expect(accepted.map((f) => f.name)).toEqual(["a.png", "c.png"]);
        expect(errors).toEqual(["b.gif: only PNG, JPG and WEBP photos can be added.", "One photo was left out — a model can have up to 10."]);
        expect(pickImageFiles(files.slice(0, 1), MAX_IMAGES).errors).toEqual(["One photo was left out — a model can have up to 10."]);
        expect(pickImageFiles([files[0], files[2], files[3]], MAX_IMAGES).errors[0]).toMatch(/^3 photos were left out/);
    });
});

describe("moveImage / makeMain", () => {
    it("moves without touching the input, clamping the target", () => {
        const list = ["a", "b", "c", "d"];
        expect(moveImage(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
        expect(moveImage(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
        expect(moveImage(list, 1, 99)).toEqual(["a", "c", "d", "b"]);
        expect(moveImage(list, 1, 1)).toBe(list);
        expect(moveImage(list, 9, 0)).toBe(list);
        expect(list).toEqual(["a", "b", "c", "d"]);
    });

    it("making a photo the main one puts it first, keeping the others' order", () => {
        expect(makeMain(["a", "b", "c", "d"], 2)).toEqual(["c", "a", "b", "d"]);
    });
});

describe("toFormImages", () => {
    it("orders by position with the primary first", () => {
        const images = toFormImages([stored("b", 1), stored("c", 2, true), stored("a", 0)]);
        expect(images.map((i) => i.id)).toEqual(["c", "a", "b"]);
        expect(images[0]).toEqual({kind: "existing", id: "c", url: "https://x.test/c.webp", thumbUrl: "https://x.test/c-t.webp", width: 1200, height: 800, alt: null});
    });
});

describe("storage paths", () => {
    it("names new photos models/{slug}/{key}-{variant}.{ext}", () => {
        expect(imageStoragePath("ferrari-499p-2023-burago-red", "3f9a0c2b7d1e", "thumb", "webp")).toBe("models/ferrari-499p-2023-burago-red/3f9a0c2b7d1e-thumb.webp");
    });

    it("makes short lowercase hex keys (the database's path check allows [a-z0-9-])", () => {
        expect(newImageKey(() => "3F9A0C2B-7D1E-4B8A-9C3D-000000000000")).toBe("3f9a0c2b7d1e");
        expect(newImageKey()).toMatch(/^[0-9a-f]{12}$/);
    });
});

describe("toImagesPayload", () => {
    it("keeps existing photos by id and sends uploaded ones by path, in list order", () => {
        const images: FormImage[] = [picked("n1"), ...toFormImages([stored("e1", 0, true)])];
        const uploaded = new Map([["n1", {storagePath: "models/x/n1-full.webp", thumbStoragePath: "models/x/n1-thumb.webp", width: 1600, height: 1000}]]);
        expect(toImagesPayload(images, uploaded)).toEqual([
            {storage_path: "models/x/n1-full.webp", thumb_storage_path: "models/x/n1-thumb.webp", width: 1600, height: 1000},
            {id: "e1"},
        ]);
    });

    it("refuses a new photo that wasn't uploaded", () => {
        expect(() => toImagesPayload([picked("n1")])).toThrow(/hasn't been uploaded/);
    });

    it("an empty list removes every photo", () => {
        expect(toImagesPayload([])).toEqual([]);
    });
});

describe("toPreviewImages / imageLabel", () => {
    it("gives the gallery shape, first = primary, new photos from their object URLs", () => {
        const preview = toPreviewImages([...toFormImages([stored("e1", 0, true)]), picked("n1")]);
        expect(preview.map((p) => [p.id, p.position, p.isPrimary, p.url])).toEqual([["e1", 0, true, "https://x.test/e1.webp"], ["n1", 1, false, "blob:n1"]]);
        expect(preview[1]).toMatchObject({thumbUrl: "blob:n1-t", width: 1600, height: 1000});
    });

    it("names the main photo", () => {
        expect(imageLabel(0, 3)).toBe("Main photo (1 of 3)");
        expect(imageLabel(2, 3)).toBe("Photo 3 of 3");
    });
});
