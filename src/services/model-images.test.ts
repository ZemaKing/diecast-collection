import {beforeEach, describe, expect, it, vi} from "vitest";

import type {NewFormImage} from "../utils/model-images.ts";
import {chainable} from "./chainable.test-data.ts";

const rpc = vi.fn();
const upload = vi.fn();
const remove = vi.fn();
vi.mock("../lib/supabase.ts", () => ({
    supabase: {
        rpc: (...args: unknown[]) => rpc(...args),
        storage: {from: () => ({upload: (...args: unknown[]) => upload(...args), remove: (...args: unknown[]) => remove(...args)})},
    },
}));

const {saveModelWithImages, uploadNewImages} = await import("./model-images.ts");

const payload = {
    slug: "ferrari-499p-2023-burago-red", name: "Ferrari 499P", year: 2023,
    brand: {slug: "ferrari", name: "Ferrari"}, manufacturer: {slug: "burago", name: "Burago"},
    category_slug: "racing", scale: "1:43", livery_hex: ["#D40000"], color_slugs: ["red"], is_racing: true,
    car_number: "51", driver: null, team: null, event: null, series: null, condition: null, location: null,
    added_at: null, is_published: true,
};

const variant = (width: number, type = "image/webp", ext: "webp" | "png" = "webp") => ({blob: new Blob(["x"]), width, height: width / 2, type, ext});
const picked = (key: string, ext: "webp" | "png" = "webp"): NewFormImage => ({
    kind: "new", key, fileName: `${key}.jpg`, full: variant(1600, `image/${ext}`, ext), thumb: variant(400, `image/${ext}`, ext), previewUrl: "", thumbPreviewUrl: "",
});
const existing = (id: string) => ({kind: "existing" as const, id, url: null, thumbUrl: null, width: null, height: null, alt: null});
const saved = (extra: Record<string, unknown> = {}) =>
    chainable({data: {slug: payload.slug, created: false, changed: true, removed_files: [], dry_run: false, ...extra}, error: null});

beforeEach(() => {
    rpc.mockReset();
    upload.mockReset().mockResolvedValue({data: {}, error: null});
    remove.mockReset().mockResolvedValue({data: [], error: null});
});

describe("uploadNewImages", () => {
    it("uploads both sizes under the model's folder with a week's caching, never overwriting", async () => {
        const progress = vi.fn();
        const result = await uploadNewImages("m", [picked("aa"), picked("bb", "png")], progress);
        expect(upload.mock.calls.map((c) => c[0])).toEqual(["models/m/aa-full.webp", "models/m/aa-thumb.webp", "models/m/bb-full.png", "models/m/bb-thumb.png"]);
        expect(upload.mock.calls[2][2]).toEqual({contentType: "image/png", cacheControl: "604800", upsert: false});
        expect(result.get("bb")).toEqual({storagePath: "models/m/bb-full.png", thumbStoragePath: "models/m/bb-thumb.png", width: 1600, height: 800});
        expect(progress.mock.calls.map((c) => c[0])).toEqual([{done: 0, total: 2}, {done: 1, total: 2}, {done: 2, total: 2}]);
    });

    it("removes what it already uploaded when one fails, and names the photo", async () => {
        upload.mockResolvedValueOnce({data: {}, error: null}).mockResolvedValueOnce({data: {}, error: null})
            .mockResolvedValueOnce({data: {}, error: null}).mockResolvedValueOnce({data: null, error: {message: "Payload too large", statusCode: "413"}});
        await expect(uploadNewImages("m", [picked("aa"), picked("bb")])).rejects.toMatchObject({message: expect.stringContaining("Couldn't upload “bb.jpg”")});
        expect(remove).toHaveBeenCalledWith(["models/m/aa-full.webp", "models/m/aa-thumb.webp", "models/m/bb-full.webp"]);
    });

    it("says plainly when the bucket doesn't exist yet", async () => {
        upload.mockResolvedValue({data: null, error: {message: "Bucket not found", status: 400}});
        await expect(uploadNewImages("m", [picked("aa")])).rejects.toMatchObject({kind: "config", message: expect.stringContaining("20260930120000")});
    });
});

describe("saveModelWithImages", () => {
    it("without images it's a plain save (photos untouched)", async () => {
        rpc.mockReturnValue(saved());
        const result = await saveModelWithImages(payload, undefined);
        expect(rpc.mock.calls[0][1].p_model).not.toHaveProperty("images");
        expect(upload).not.toHaveBeenCalled();
        expect(result.orphanedFiles).toEqual([]);
    });

    it("uploads first, saves the ordered list in one call, then deletes the dropped photos' files", async () => {
        rpc.mockReturnValue(saved({removed_files: ["models/x/0-full.webp", "models/x/0-thumb.webp"]}));
        const result = await saveModelWithImages(payload, [picked("nn"), existing("e2")], {originalSlug: "x"});
        // The folder is the ORIGINAL address when editing.
        expect(upload.mock.calls[0][0]).toBe("models/x/nn-full.webp");
        expect(rpc).toHaveBeenCalledWith("save_model", {
            p_model: {...payload, images: [{storage_path: "models/x/nn-full.webp", thumb_storage_path: "models/x/nn-thumb.webp", width: 1600, height: 800}, {id: "e2"}]},
            p_original_slug: "x",
            p_dry_run: false,
        });
        expect(remove).toHaveBeenCalledWith(["models/x/0-full.webp", "models/x/0-thumb.webp"]);
        expect(upload.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
        expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
        expect(result).toMatchObject({changed: true, removedFiles: ["models/x/0-full.webp", "models/x/0-thumb.webp"], orphanedFiles: []});
    });

    it("a new model's photos go in its new address", async () => {
        rpc.mockReturnValue(saved({created: true}));
        await saveModelWithImages(payload, [picked("nn")]);
        expect(upload.mock.calls[0][0]).toBe(`models/${payload.slug}/nn-full.webp`);
    });

    it("removes the fresh uploads when the database refuses the save", async () => {
        rpc.mockReturnValue(chainable({data: null, error: {code: "ZK409", message: "A model with the address \"x\" already exists."}}));
        await expect(saveModelWithImages(payload, [picked("nn")])).rejects.toMatchObject({kind: "conflict"});
        expect(remove).toHaveBeenCalledWith([`models/${payload.slug}/nn-full.webp`, `models/${payload.slug}/nn-thumb.webp`]);
    });

    it("reports files it couldn't delete after a successful save", async () => {
        rpc.mockReturnValue(saved({removed_files: ["models/x/a-full.webp"]}));
        remove.mockResolvedValue({data: null, error: {message: "boom"}});
        await expect(saveModelWithImages(payload, [], {originalSlug: "x"})).resolves.toMatchObject({changed: true, orphanedFiles: ["models/x/a-full.webp"]});
    });

    it("never touches Storage when nothing was added or removed", async () => {
        rpc.mockReturnValue(saved({changed: false}));
        await saveModelWithImages(payload, [existing("e1")], {originalSlug: "x"});
        expect(upload).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
    });
});
