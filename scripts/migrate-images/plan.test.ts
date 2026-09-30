import {describe, expect, it} from "vitest";

import {variantSettings} from "../images/convert.ts";
import {emptyManifest, type Manifest, type ManifestEntry} from "../images/manifest.ts";
import job, {rowToSource, type ImageRow} from "./job.ts";
import {planFlip, planRollback} from "./plan.ts";

const row = (slug: string, overrides: Partial<ImageRow> = {}): ImageRow => ({
    id: `id-${slug}`,
    position: 0,
    storage_path: null,
    thumb_storage_path: null,
    external_url: `https://i.postimg.cc/X/${slug}.png`,
    thumb_external_url: `https://i.postimg.cc/X/${slug}-thumbnail.png`,
    width: null,
    height: null,
    models: {slug},
    ...overrides,
});

function uploaded(manifest: Manifest, r: ImageRow, variant: "full" | "thumb", overrides: Partial<ManifestEntry> = {}) {
    const v = job.variants.find((x) => x.name === variant)!;
    manifest.objects[`models/${r.models.slug}/${r.position}-${variant}.webp`] = {
        source: `${r.models.slug}/${r.position}`,
        sourceUrl: r.external_url!,
        sourceSha256: "src",
        sourceBytes: 900_000,
        sourceWidth: 1077,
        sourceHeight: 800,
        variant,
        settings: variantSettings(v),
        contentType: "image/webp",
        sha256: `${variant}-sha`,
        bytes: variant === "full" ? 110_000 : 25_000,
        width: variant === "full" ? 1077 : 400,
        height: variant === "full" ? 800 : 297,
        uploadedAt: "2026-09-30T00:00:00.000Z",
        ...overrides,
    };
}

describe("job", () => {
    it("maps a row to a source keyed by slug/position, from the full-size postimg URL", () => {
        expect(rowToSource(row("ford-gt"))).toEqual({key: "ford-gt/0", url: "https://i.postimg.cc/X/ford-gt.png", vars: {slug: "ford-gt", position: 0}});
        expect(rowToSource(row("ford-gt", {external_url: null, storage_path: "models/ford-gt/0-full.webp"}))).toBeNull();
    });
});

describe("planFlip", () => {
    it("points each row at its uploaded full + thumb objects, with the full image's dimensions", () => {
        const manifest = emptyManifest(job.name, job.bucket);
        const a = row("a");
        uploaded(manifest, a, "full");
        uploaded(manifest, a, "thumb");
        const plan = planFlip(job, [a], manifest);
        expect(plan.problems).toEqual([]);
        expect(plan.rows).toEqual([{id: "id-a", storage_path: "models/a/0-full.webp", thumb_storage_path: "models/a/0-thumb.webp", width: 1077, height: 800}]);
        expect(Object.keys(plan.objects)).toEqual(["models/a/0-full.webp", "models/a/0-thumb.webp"]);
    });

    it("blocks on anything not uploaded, uploaded from another URL, or with old settings", () => {
        const manifest = emptyManifest(job.name, job.bucket);
        const [a, b, c] = [row("a"), row("b"), row("c")];
        uploaded(manifest, a, "full"); // thumb missing
        uploaded(manifest, b, "full", {sourceUrl: "https://i.postimg.cc/OLD/b.png"});
        uploaded(manifest, b, "thumb");
        uploaded(manifest, c, "full");
        uploaded(manifest, c, "thumb", {settings: "thumb:webp:300x300:q50"});
        const plan = planFlip(job, [a, b, c], manifest);
        expect(plan.rows).toEqual([]);
        expect(plan.problems).toEqual([
            "a/0: models/a/0-thumb.webp not uploaded",
            "b/0: models/b/0-full.webp was uploaded from another URL or with other settings",
            "c/0: models/c/0-thumb.webp was uploaded from another URL or with other settings",
        ]);
    });

    it("counts rows already flipped as unchanged (still verified) and ignores Storage-only rows", () => {
        const manifest = emptyManifest(job.name, job.bucket);
        const done = row("a", {storage_path: "models/a/0-full.webp", thumb_storage_path: "models/a/0-thumb.webp"});
        uploaded(manifest, done, "full");
        uploaded(manifest, done, "thumb");
        const storageOnly = row("z", {external_url: null, storage_path: "models/z/0-full.webp"});
        const plan = planFlip(job, [done, storageOnly], manifest);
        expect(plan).toMatchObject({rows: [], problems: [], unchanged: 1});
        expect(Object.keys(plan.objects)).toHaveLength(2);
    });
});

describe("planRollback", () => {
    it("clears Storage paths where external_url can take over", () => {
        const flipped = row("a", {storage_path: "models/a/0-full.webp", thumb_storage_path: "models/a/0-thumb.webp"});
        const stuck = row("b", {storage_path: "models/b/0-full.webp", external_url: null});
        const plan = planRollback([flipped, stuck, row("c")]);
        expect(plan.rows).toEqual([{id: "id-a", storage_path: null, thumb_storage_path: null}]);
        expect(plan.unchanged).toBe(1);
        expect(plan.problems).toEqual(["b/0: no external_url to fall back to — left on Storage"]);
    });
});
