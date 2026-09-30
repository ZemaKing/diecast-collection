// Checks what Storage actually serves against the manifest.
//   head: public URL answers 200 with the recorded content-type and size
//   full: downloads it and compares sha256 + dimensions (the "checksums" check)
import {readImageInfo, sha256} from "./convert.ts";
import {mapPool, DEFAULTS} from "./batch.ts";
import type {ManifestEntry} from "./manifest.ts";
import {errorMessage, HttpError, withRetry} from "./retry.ts";

export type VerifyMode = "head" | "full";
export type VerifyResult = {path: string; url: string; ok: boolean; problem?: string};

export type VerifyOptions = {
    mode: VerifyMode;
    publicUrl: (path: string) => string;
    fetchImpl?: typeof fetch;
    retries?: number;
    concurrency?: number;
    sleep?: (ms: number) => Promise<void>;
};

export async function verifyObject(path: string, entry: ManifestEntry, options: VerifyOptions): Promise<VerifyResult> {
    const {mode, publicUrl, fetchImpl = fetch, retries = DEFAULTS.retries, sleep} = options;
    const url = publicUrl(path);
    const fail = (problem: string): VerifyResult => ({path, url, ok: false, problem});
    try {
        const response = await withRetry(async () => {
            const r = await fetchImpl(url, {method: mode === "head" ? "HEAD" : "GET", signal: AbortSignal.timeout(DEFAULTS.timeoutMs)});
            if (!r.ok) throw new HttpError(r.status, `HTTP ${r.status}`);
            return r;
        }, {retries, sleep});
        const type = response.headers.get("content-type");
        if (type !== entry.contentType) return fail(`content-type ${type}, expected ${entry.contentType}`);
        if (mode === "head") {
            const length = Number(response.headers.get("content-length"));
            return length && length !== entry.bytes ? fail(`${length} bytes, expected ${entry.bytes}`) : {path, url, ok: true};
        }
        const body = Buffer.from(await response.arrayBuffer());
        if (body.length !== entry.bytes) return fail(`${body.length} bytes, expected ${entry.bytes}`);
        if (sha256(body) !== entry.sha256) return fail("sha256 differs from the manifest");
        const info = await readImageInfo(body);
        if (info.width !== entry.width || info.height !== entry.height) {
            return fail(`${info.width}×${info.height}, expected ${entry.width}×${entry.height}`);
        }
        return {path, url, ok: true};
    } catch (error) {
        return fail(errorMessage(error));
    }
}

export function verifyObjects(objects: Record<string, ManifestEntry>, options: VerifyOptions): Promise<VerifyResult[]> {
    const entries = Object.entries(objects);
    return mapPool(entries, options.concurrency ?? 8, ([path, entry]) => verifyObject(path, entry, options));
}
