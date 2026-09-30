// @vitest-environment node
// The batch converter end to end, with real sharp conversions but a fake network and fake Storage.
import sharp from "sharp";
import {beforeAll, describe, expect, it} from "vitest";

import {checkSources, download, mapPool, runBatch} from "./batch.ts";
import {convertVariant, readImageInfo, sha256, variantSettings} from "./convert.ts";
import {emptyManifest, isDone, type Manifest} from "./manifest.ts";
import type {ImageJob, ImageSource, StorageTarget} from "./types.ts";
import {verifyObjects} from "./verify.ts";

const noSleep = () => Promise.resolve();

let png: Buffer; // 1200×900 with transparency, like the model photos

beforeAll(async () => {
    png = await sharp({create: {width: 1200, height: 900, channels: 4, background: {r: 200, g: 30, b: 30, alpha: 0.5}}}).png().toBuffer();
});

const job: ImageJob = {
    name: "test",
    bucket: "b",
    pathPattern: "items/{slug}/{position}-{variant}.{ext}",
    variants: [
        {name: "full", maxWidth: 1600, quality: 80},
        {name: "thumb", maxWidth: 400, quality: 70},
    ],
    manifest: new URL("file:///unused.json"),
    concurrency: 2,
    retries: 2,
    sources: async () => [],
};

const source = (slug: string, url = `https://img.test/${slug}.png`): ImageSource => ({key: `${slug}/0`, url, vars: {slug, position: 0}});

type Responder = (url: string, init?: RequestInit) => Response;
function fakeFetch(respond: Responder) {
    const calls: string[] = [];
    const impl = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        calls.push(`${init?.method ?? "GET"} ${url}`);
        return respond(url, init);
    }) as typeof fetch;
    return {impl, calls};
}
const image = (body: Buffer, type = "image/png") => new Response(new Uint8Array(body), {headers: {"content-type": type, "content-length": String(body.length)}});

function fakeStorage() {
    const objects = new Map<string, {data: Buffer; contentType: string}>();
    const uploads: string[] = [];
    const target: StorageTarget = {
        stat: async (path) => (objects.has(path) ? {size: objects.get(path)!.data.length} : null),
        upload: async (path, data, {contentType}) => {
            uploads.push(path);
            objects.set(path, {data, contentType});
        },
        publicUrl: (path) => `https://cdn.test/${path}`,
    };
    return {target, objects, uploads};
}

describe("convertVariant", () => {
    it("fits inside the box without enlarging, keeps alpha, outputs WebP", async () => {
        const thumb = await convertVariant(png, {name: "thumb", maxWidth: 400, quality: 70});
        expect([thumb.width, thumb.height]).toEqual([400, 300]);
        const meta = await sharp(thumb.data).metadata();
        expect(meta.format).toBe("webp");
        expect(meta.hasAlpha).toBe(true);
        expect(thumb.sha256).toBe(sha256(thumb.data));

        const full = await convertVariant(png, {name: "full", maxWidth: 1600, quality: 80});
        expect([full.width, full.height]).toEqual([1200, 900]); // never enlarged
    });

    it("bounds the longest edge of a portrait image by default", async () => {
        const portrait = await sharp({create: {width: 900, height: 1200, channels: 3, background: "#000"}}).png().toBuffer();
        const out = await convertVariant(portrait, {name: "thumb", maxWidth: 400, quality: 70});
        expect([out.width, out.height]).toEqual([300, 400]);
    });

    it("rejects data that isn't an image", async () => {
        await expect(readImageInfo(Buffer.from("<html>not found</html>"))).rejects.toThrow("Not a readable image");
    });
});

describe("download", () => {
    it("fails on a non-2xx status, a non-image type and a truncated body", async () => {
        const notFound = fakeFetch(() => new Response(new Uint8Array(png.subarray(0, 10)), {status: 404, headers: {"content-type": "image/png"}}));
        await expect(download("https://x/a.png", notFound.impl)).rejects.toMatchObject({status: 404});
        const html = fakeFetch(() => new Response("hi", {headers: {"content-type": "text/html"}}));
        await expect(download("https://x/a.png", html.impl)).rejects.toThrow("not an image");
        const short = fakeFetch(() => new Response(new Uint8Array(png.subarray(0, 10)), {headers: {"content-type": "image/png", "content-length": "999"}}));
        await expect(download("https://x/a.png", short.impl)).rejects.toThrow("truncated");
    });
});

describe("checkSources", () => {
    it("rejects duplicate keys and colliding paths", () => {
        expect(() => checkSources(job, [source("a"), source("a")])).toThrow("Duplicate");
        expect(() => checkSources(job, [source("a"), {...source("a"), key: "other"}])).toThrow("both map to");
    });
});

describe("runBatch", () => {
    it("dry run: downloads and converts, never uploads or touches the manifest", async () => {
        const net = fakeFetch(() => image(png));
        const storage = fakeStorage();
        const manifest = emptyManifest("test", "b");
        const summary = await runBatch(job, [source("a"), source("b")], storage.target, manifest, {apply: false, fetchImpl: net.impl, sleep: noSleep});
        expect(summary.counts).toMatchObject({planned: 2, uploaded: 0, failed: 0});
        expect(storage.uploads).toEqual([]);
        expect(manifest.objects).toEqual({});
        expect(summary.byVariant.thumb.count).toBe(2);
        expect(summary.outputBytes).toBeGreaterThan(0);
    });

    it("apply: uploads every variant and records checksums; a re-run skips everything", async () => {
        const net = fakeFetch(() => image(png));
        const storage = fakeStorage();
        const manifest: Manifest = emptyManifest("test", "b");
        let saves = 0;
        const opts = {apply: true, fetchImpl: net.impl, sleep: noSleep, persist: () => saves++};

        const first = await runBatch(job, [source("a")], storage.target, manifest, opts);
        expect(first.counts.uploaded).toBe(1);
        expect(storage.uploads.sort()).toEqual(["items/a/0-full.webp", "items/a/0-thumb.webp"]);
        expect(saves).toBe(1);
        const thumb = manifest.objects["items/a/0-thumb.webp"];
        expect(thumb).toMatchObject({source: "a/0", sourceUrl: "https://img.test/a.png", sourceSha256: sha256(png), width: 400, height: 300, contentType: "image/webp"});
        expect(thumb.sha256).toBe(sha256(storage.objects.get("items/a/0-thumb.webp")!.data));
        expect(thumb.settings).toBe(variantSettings(job.variants[1]));

        const again = await runBatch(job, [source("a")], storage.target, manifest, opts);
        expect(again.counts).toMatchObject({skipped: 1, uploaded: 0});
        expect(net.calls).toHaveLength(1); // no second download
        expect(again.outputBytes).toBe(first.outputBytes);
    });

    it("redoes a source whose object vanished, whose URL changed, or with --force", async () => {
        const net = fakeFetch(() => image(png));
        const storage = fakeStorage();
        const manifest = emptyManifest("test", "b");
        const opts = {apply: true, fetchImpl: net.impl, sleep: noSleep};
        await runBatch(job, [source("a")], storage.target, manifest, opts);

        storage.objects.delete("items/a/0-thumb.webp");
        expect((await runBatch(job, [source("a")], storage.target, manifest, opts)).counts.uploaded).toBe(1);

        const moved = source("a", "https://img.test/a-v2.png");
        expect(isDone(manifest, "items/a/0-full.webp", moved, job.variants[0])).toBe(false);
        expect((await runBatch(job, [moved], storage.target, manifest, opts)).counts.uploaded).toBe(1);
        expect(manifest.objects["items/a/0-full.webp"].sourceUrl).toBe("https://img.test/a-v2.png");

        expect((await runBatch(job, [moved], storage.target, manifest, {...opts, force: true})).counts.uploaded).toBe(1);
    });

    it("retries transient download failures, and reports permanent ones without stopping the batch", async () => {
        let flaky = 0;
        const net = fakeFetch((url) => {
            if (url.includes("flaky") && flaky++ < 2) return new Response("", {status: 503});
            if (url.includes("gone")) return new Response(new Uint8Array(png.subarray(0, 100)), {status: 404, headers: {"content-type": "image/png"}});
            return image(png);
        });
        const storage = fakeStorage();
        const manifest = emptyManifest("test", "b");
        const log: string[] = [];
        const summary = await runBatch(job, [source("flaky"), source("gone"), source("fine")], storage.target, manifest, {
            apply: true, fetchImpl: net.impl, sleep: noSleep, log: (l) => log.push(l),
        });
        expect(summary.counts).toMatchObject({uploaded: 2, failed: 1});
        expect(summary.results.find((r) => r.key === "gone/0")?.error).toContain("HTTP 404");
        expect(net.calls.filter((c) => c.includes("gone"))).toHaveLength(1); // 404 not retried
        expect(log.filter((l) => l.includes("↻ download flaky/0"))).toHaveLength(2);
        expect(Object.keys(manifest.objects).some((p) => p.includes("/gone/"))).toBe(false);
    });

    it("fails a source when Storage reports a different size after upload", async () => {
        const net = fakeFetch(() => image(png));
        const storage = fakeStorage();
        const target = {...storage.target, stat: async () => ({size: 1})};
        const manifest = emptyManifest("test", "b");
        const summary = await runBatch(job, [source("a")], target, manifest, {apply: true, fetchImpl: net.impl, sleep: noSleep});
        expect(summary.counts.failed).toBe(1);
        expect(summary.results[0].error).toContain("Storage reports 1");
        expect(manifest.objects).toEqual({});
    });
});

describe("verifyObjects", () => {
    it("head: status, type and size; full: sha256 and dimensions", async () => {
        const net = fakeFetch(() => image(png));
        const storage = fakeStorage();
        const manifest = emptyManifest("test", "b");
        await runBatch(job, [source("a")], storage.target, manifest, {apply: true, fetchImpl: net.impl, sleep: noSleep});

        const served = fakeFetch((url, init) => {
            const path = url.replace("https://cdn.test/", "");
            const object = storage.objects.get(path);
            if (!object) return new Response("", {status: 400});
            return new Response(init?.method === "HEAD" ? null : new Uint8Array(object.data), {
                headers: {"content-type": object.contentType, "content-length": String(object.data.length)},
            });
        });
        const options = {publicUrl: storage.target.publicUrl, fetchImpl: served.impl, sleep: noSleep, retries: 1};
        for (const mode of ["head", "full"] as const) {
            const results = await verifyObjects(manifest.objects, {...options, mode});
            expect(results.every((r) => r.ok)).toBe(true);
        }

        // Corrupt one object (same size, different bytes) → only the full check notices.
        const thumb = storage.objects.get("items/a/0-thumb.webp")!;
        thumb.data = Buffer.from(thumb.data.map((b, i) => (i === thumb.data.length - 1 ? b ^ 0xff : b)));
        expect((await verifyObjects(manifest.objects, {...options, mode: "head"})).every((r) => r.ok)).toBe(true);
        const full = await verifyObjects(manifest.objects, {...options, mode: "full"});
        expect(full.find((r) => !r.ok)?.problem).toContain("sha256");

        storage.objects.delete("items/a/0-full.webp");
        const missing = await verifyObjects(manifest.objects, {...options, mode: "head"});
        expect(missing.find((r) => r.path.endsWith("full.webp"))?.problem).toContain("HTTP 400");
    });
});

describe("mapPool", () => {
    it("keeps order and never exceeds the concurrency", async () => {
        let running = 0;
        let peak = 0;
        const out = await mapPool([5, 1, 4, 2, 3], 2, async (n) => {
            peak = Math.max(peak, ++running);
            await new Promise((r) => setTimeout(r, n));
            running--;
            return n * 10;
        });
        expect(out).toEqual([50, 10, 40, 20, 30]);
        expect(peak).toBe(2);
    });
});
