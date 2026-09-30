import {beforeEach, describe, expect, it, vi} from "vitest";

import {chainable} from "./chainable.test-data.ts";

const from = vi.fn();
const rpc = vi.fn();
const remove = vi.fn();
vi.mock("../lib/supabase.ts", () => ({
    supabase: {
        from: (...args: unknown[]) => from(...args),
        rpc: (...args: unknown[]) => rpc(...args),
        storage: {from: () => ({remove: (...args: unknown[]) => remove(...args)})},
    },
}));

const {deleteModel, isSlugTaken, saveModel} = await import("./model-admin.ts");

const payload = {
    slug: "ferrari-499p-2023-burago-red",
    name: "Ferrari 499P",
    year: 2023,
    brand: {slug: "ferrari", name: "Ferrari"},
    manufacturer: {slug: "burago", name: "Burago"},
    category_slug: "racing",
    scale: "1:43",
    livery_hex: ["#D40000"],
    color_slugs: ["red"],
    is_racing: true,
    car_number: "51",
    driver: null,
    team: null,
    event: null,
    series: null,
    condition: null,
    location: null,
    added_at: null,
    is_published: true,
};

describe("saveModel", () => {
    beforeEach(() => rpc.mockReset());

    it("calls diecast.save_model once — model and colors in one transaction", async () => {
        rpc.mockReturnValue(chainable({data: {slug: payload.slug, created: true, changed: true, dry_run: false}, error: null}));
        const result = await saveModel(payload);
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(rpc).toHaveBeenCalledWith("save_model", {p_model: payload, p_original_slug: undefined, p_dry_run: false});
        expect(result).toEqual({slug: payload.slug, created: true, changed: true, dryRun: false});
    });

    it("updates by the original slug", async () => {
        rpc.mockReturnValue(chainable({data: {slug: payload.slug, created: false, changed: false, dry_run: true}, error: null}));
        const result = await saveModel(payload, {originalSlug: payload.slug, dryRun: true});
        expect(rpc).toHaveBeenCalledWith("save_model", {p_model: payload, p_original_slug: payload.slug, p_dry_run: true});
        expect(result.changed).toBe(false);
    });

    it("surfaces the database's own message for a taken address", async () => {
        rpc.mockReturnValue(chainable({data: null, error: {code: "ZK409", message: `A model with the address "${payload.slug}" already exists.`}}));
        await expect(saveModel(payload)).rejects.toMatchObject({kind: "conflict", message: expect.stringContaining("already exists")});
    });
});

describe("isSlugTaken", () => {
    beforeEach(() => from.mockReset());

    it("is true when a model (draft or not) has the slug", async () => {
        from.mockReturnValueOnce(chainable({data: [{slug: "x"}], error: null}));
        await expect(isSlugTaken("x")).resolves.toBe(true);
        from.mockReturnValueOnce(chainable({data: [], error: null}));
        await expect(isSlugTaken("y")).resolves.toBe(false);
    });
});

describe("deleteModel", () => {
    beforeEach(() => {
        from.mockReset();
        remove.mockReset();
    });

    it("deletes the row, then removes the model's Storage files", async () => {
        const deleteCall = chainable({data: [{id: "m1"}], error: null});
        from
            .mockReturnValueOnce(chainable({data: [{id: "m1"}], error: null}))
            .mockReturnValueOnce(chainable({data: [{storage_path: "models/x/0-full.webp", thumb_storage_path: "models/x/0-thumb.webp"}, {storage_path: null, thumb_storage_path: null}], error: null}))
            .mockReturnValueOnce(deleteCall);
        remove.mockResolvedValue({data: [], error: null});

        await expect(deleteModel("x")).resolves.toEqual({orphanedFiles: []});
        expect(deleteCall.calls).toEqual([["delete", []], ["eq", ["id", "m1"]], ["select", ["id"]]]);
        expect(remove).toHaveBeenCalledWith(["models/x/0-full.webp", "models/x/0-thumb.webp"]);
    });

    it("skips Storage when the photos are external (postimg)", async () => {
        from
            .mockReturnValueOnce(chainable({data: [{id: "m1"}], error: null}))
            .mockReturnValueOnce(chainable({data: [{storage_path: null, thumb_storage_path: null}], error: null}))
            .mockReturnValueOnce(chainable({data: [{id: "m1"}], error: null}));
        await expect(deleteModel("x")).resolves.toEqual({orphanedFiles: []});
        expect(remove).not.toHaveBeenCalled();
    });

    it("reports Storage files it couldn't remove without failing the delete", async () => {
        from
            .mockReturnValueOnce(chainable({data: [{id: "m1"}], error: null}))
            .mockReturnValueOnce(chainable({data: [{storage_path: "models/x/0-full.webp", thumb_storage_path: null}], error: null}))
            .mockReturnValueOnce(chainable({data: [{id: "m1"}], error: null}));
        remove.mockResolvedValue({data: null, error: {message: "Bucket not found"}});
        await expect(deleteModel("x")).resolves.toEqual({orphanedFiles: ["models/x/0-full.webp"]});
    });

    it("treats a delete that matched nothing as refused (RLS doesn't error on DELETE)", async () => {
        from
            .mockReturnValueOnce(chainable({data: [{id: "m1"}], error: null}))
            .mockReturnValueOnce(chainable({data: [], error: null}))
            .mockReturnValueOnce(chainable({data: [], error: null}));
        await expect(deleteModel("x")).rejects.toMatchObject({kind: "permission"});
    });

    it("is not_found for an unknown slug", async () => {
        from.mockReturnValueOnce(chainable({data: [], error: null}));
        await expect(deleteModel("nope")).rejects.toMatchObject({kind: "not_found"});
    });
});
