import {beforeEach, describe, expect, it, vi} from "vitest";

import {chainable} from "./chainable.test-data.ts";

const from = vi.fn();
const rpc = vi.fn();
const upload = vi.fn();
const remove = vi.fn();
const storageFrom = vi.fn(() => ({upload, remove}));
vi.mock("../lib/supabase.ts", () => ({
    supabase: {
        from: (...args: unknown[]) => from(...args),
        rpc: (...args: unknown[]) => rpc(...args),
        storage: {from: (...args: unknown[]) => storageFrom(...(args as []))},
    },
}));

const {deleteLookup, getLookupRows, mergeDrivers, removeLogoFiles, saveLookup} = await import("./lookup-admin.ts");

const brandRow = {id: "b1", slug: "alpine", name: "Alpine", logo_path: null, created_at: "", updated_at: ""};
const editing = {id: "b1", slug: "alpine", name: "Alpine", logoPath: "brands/alpine-old.svg", countryCode: null, hex: null, sortOrder: 0, count: 2};
const svg = {action: "upload" as const, blob: new Blob(["<svg/>"]), ext: "svg" as const, contentType: "image/svg+xml"};

describe("getLookupRows", () => {
    beforeEach(() => from.mockReset());

    it("adds each row's model count (models column for brands)", async () => {
        from.mockImplementation((table: string) => table === "brands"
            ? chainable({data: [brandRow, {...brandRow, id: "b2", slug: "ford", name: "Ford"}], error: null})
            : chainable({data: [{brand_id: "b1"}, {brand_id: "b1"}, {brand_id: "b9"}], error: null}));
        const rows = await getLookupRows("brands");
        expect(rows.map((r) => [r.slug, r.count])).toEqual([["alpine", 2], ["ford", 0]]);
        expect(from).toHaveBeenCalledWith("models");
    });

    it("counts colors and tags through their join tables", async () => {
        from.mockImplementation((table: string) => table === "colors"
            ? chainable({data: [{id: "c1", slug: "red", name: "Red", hex: "#D40000", sort_order: 3}], error: null})
            : chainable({data: [{color_id: "c1"}], error: null}));
        const [red] = await getLookupRows("colors");
        expect(red).toMatchObject({slug: "red", hex: "#D40000", sortOrder: 3, count: 1});
        expect(from).toHaveBeenCalledWith("model_colors");
    });
});

describe("saveLookup", () => {
    beforeEach(() => {
        from.mockReset();
        upload.mockReset().mockResolvedValue({error: null});
        remove.mockReset().mockResolvedValue({error: null});
    });

    it("creates a row with the address made from its name", async () => {
        const chain = chainable({data: [{...brandRow, slug: "leo-models", name: "Leo Models"}], error: null});
        from.mockReturnValue(chain);
        const result = await saveLookup("brands", {editing: null, write: {name: "Leo Models"}});
        expect(chain.calls).toContainEqual(["insert", [{name: "Leo Models", logo_path: null, slug: "leo-models"}]]);
        expect(result.row).toMatchObject({slug: "leo-models", name: "Leo Models"});
        expect(upload).not.toHaveBeenCalled();
    });

    it("uploads a logo under a fresh key BEFORE writing the row, then removes the replaced file", async () => {
        const order: string[] = [];
        upload.mockImplementation(async (path: string) => {
            order.push(`upload ${path}`);
            return {error: null};
        });
        const chain = chainable({data: [{...brandRow, logo_path: "brands/alpine-new.svg"}], error: null});
        from.mockImplementation(() => {
            order.push("update");
            return chain;
        });
        remove.mockImplementation(async (paths: string[]) => {
            order.push(`remove ${paths.join()}`);
            return {error: null};
        });

        const result = await saveLookup("brands", {editing, write: {name: "Alpine"}, logo: svg});
        expect(order[0]).toMatch(/^upload brands\/alpine-[0-9a-f]{12}\.svg$/);
        expect(order.slice(1)).toEqual(["update", "remove brands/alpine-old.svg"]);
        expect(storageFrom).toHaveBeenCalledWith("lookup-logos");
        expect(result.orphanedFiles).toEqual([]);
    });

    it("removes the just-uploaded logo when the row write is refused", async () => {
        from.mockReturnValue(chainable({data: null, error: {message: "duplicate key", code: "23505"}}));
        await expect(saveLookup("brands", {editing: null, write: {name: "Alpine"}, logo: svg}))
            .rejects.toMatchObject({kind: "conflict", message: "There's already a brand with that name or address."});
        const uploaded = upload.mock.calls[0][0];
        expect(remove).toHaveBeenCalledWith([uploaded]);
    });

    it("treats an UPDATE that matched nothing (RLS) as refused", async () => {
        from.mockReturnValue(chainable({data: [], error: null}));
        await expect(saveLookup("brands", {editing, write: {name: "Alpine 2"}})).rejects.toMatchObject({kind: "permission"});
    });

    it("never deletes a logo shipped in public/ when it's replaced or removed", async () => {
        from.mockReturnValue(chainable({data: [brandRow], error: null}));
        await saveLookup("brands", {editing: {...editing, logoPath: "/brands/Alpine.svg"}, write: {name: "Alpine"}, logo: {action: "remove"}});
        expect(remove).not.toHaveBeenCalled();
    });

    it("reports a replaced logo it couldn't delete, without failing the save", async () => {
        from.mockReturnValue(chainable({data: [brandRow], error: null}));
        remove.mockResolvedValue({error: {message: "nope"}});
        const result = await saveLookup("brands", {editing, write: {name: "Alpine"}, logo: {action: "remove"}});
        expect(result.orphanedFiles).toEqual(["brands/alpine-old.svg"]);
    });

    it("gives a new color the next sort position", async () => {
        const insert = chainable({data: [{id: "c9", slug: "teal", name: "Teal", hex: "#008080", sort_order: 14}], error: null});
        from.mockImplementationOnce(() => chainable({data: [{sort_order: 13}], error: null})).mockImplementationOnce(() => insert);
        await saveLookup("colors", {editing: null, write: {name: "Teal", hex: "#008080"}});
        expect(insert.calls).toContainEqual(["insert", [{name: "Teal", hex: "#008080", sort_order: 14, slug: "teal"}]]);
    });

    it("says when the logo bucket's migration is missing", async () => {
        upload.mockResolvedValue({error: {message: "Bucket not found"}});
        await expect(saveLookup("brands", {editing: null, write: {name: "Alpine"}, logo: svg}))
            .rejects.toMatchObject({kind: "config", message: expect.stringMatching(/20261002090000/)});
        expect(from).not.toHaveBeenCalled();
    });
});

describe("deleteLookup", () => {
    beforeEach(() => {
        from.mockReset();
        remove.mockReset().mockResolvedValue({error: null});
    });

    it("deletes the row, then its uploaded logo", async () => {
        const chain = chainable({data: [{id: "b1"}], error: null});
        from.mockReturnValue(chain);
        await expect(deleteLookup("brands", {slug: "alpine", logoPath: "brands/alpine-old.svg"})).resolves.toEqual({orphanedFiles: []});
        expect(chain.calls).toContainEqual(["eq", ["slug", "alpine"]]);
        expect(remove).toHaveBeenCalledWith(["brands/alpine-old.svg"]);
    });

    it("explains a refusal because the row is still in use (FK RESTRICT)", async () => {
        from.mockReturnValue(chainable({data: null, error: {message: "violates foreign key constraint", code: "23503"}}));
        await expect(deleteLookup("drivers", {slug: "x", logoPath: null}))
            .rejects.toMatchObject({kind: "conflict", message: expect.stringMatching(/driver is still used/)});
    });

    it("treats a DELETE that matched nothing as refused", async () => {
        from.mockReturnValue(chainable({data: [], error: null}));
        await expect(deleteLookup("tags", {slug: "x", logoPath: null})).rejects.toMatchObject({kind: "permission"});
    });
});

describe("mergeDrivers / removeLogoFiles", () => {
    it("calls merge_drivers and maps the result", async () => {
        rpc.mockResolvedValue({data: {from: "Sebastien Loeb", into: "Sébastien Loeb", moved: 3, dry_run: false}, error: null});
        await expect(mergeDrivers("sebastien-loeb-2", "sebastien-loeb")).resolves.toEqual({from: "Sebastien Loeb", into: "Sébastien Loeb", moved: 3, dryRun: false});
        expect(rpc).toHaveBeenCalledWith("merge_drivers", {p_from_slug: "sebastien-loeb-2", p_into_slug: "sebastien-loeb", p_dry_run: false});
    });

    it("only ever removes Storage keys", async () => {
        remove.mockReset().mockResolvedValue({error: null});
        await expect(removeLogoFiles(["/brands/Ford.svg"])).resolves.toEqual([]);
        expect(remove).not.toHaveBeenCalled();
    });
});
