// `npm run images:verify` — the Phase 21 verification, against the live database:
//
//   1. every model_images row resolves — the same resolveImageUrl() the app uses — and both its full
//      and thumbnail URLs answer HEAD 200 with an image content-type;
//   2. spot checks: a random sample of Storage objects is downloaded and compared with the manifest
//      (bytes, sha256, dimensions) — `--sample=N` (default 20, `--sample=all` for every object);
//   3. the rollback path: every external_url / thumb_external_url still answers 200 (`--legacy`).
//
// Exit code 1 on any failure. Needs VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).
import {mapPool} from "../images/batch.ts";
import {loadManifest} from "../images/manifest.ts";
import {errorMessage, HttpError, withRetry} from "../images/retry.ts";
import {createServiceClient, projectUrlFromEnv, supabaseTarget} from "../images/supabase-target.ts";
import {verifyObjects} from "../images/verify.ts";
import {resolveImageUrl} from "../../src/services/image-url.ts";
import job, {loadImageRows, sourceKey} from "./job.ts";

const argv = process.argv.slice(2);
const legacy = argv.includes("--legacy");
const sampleArg = argv.find((a) => a.startsWith("--sample="))?.split("=")[1] ?? "20";
const sample = sampleArg === "all" ? Infinity : Number(sampleArg);
if (!(sample >= 0)) throw new Error("--sample needs a number or 'all'.");

const supabase = createServiceClient();
const projectUrl = projectUrlFromEnv();
const rows = await loadImageRows(supabase);
const storageBase = `${projectUrl}/storage/v1/object/public/`;

type Check = {what: string; url: string};
const failures: string[] = [];

async function head({what, url}: Check): Promise<void> {
    try {
        await withRetry(async () => {
            const response = await fetch(url, {method: "HEAD", signal: AbortSignal.timeout(30_000)});
            if (!response.ok) throw new HttpError(response.status, `HTTP ${response.status}`);
            const type = response.headers.get("content-type") ?? "";
            if (!type.startsWith("image/")) throw new HttpError(415, `content-type ${type || "missing"}`);
        }, {retries: job.retries ?? 4});
    } catch (error) {
        failures.push(`${what}: ${errorMessage(error)} — ${url}`);
    }
}

// 1. What the app will load.
const appChecks: Check[] = [];
let fromStorage = 0;
for (const row of rows) {
    const key = sourceKey(row);
    const full = resolveImageUrl({storagePath: row.storage_path, externalUrl: row.external_url}, projectUrl);
    const thumb = resolveImageUrl({storagePath: row.thumb_storage_path, externalUrl: row.thumb_external_url}, projectUrl) ?? full;
    if (!full) {
        failures.push(`${key}: no URL at all`);
        continue;
    }
    if (full.startsWith(storageBase) && thumb?.startsWith(storageBase)) fromStorage++;
    appChecks.push({what: `${key} full`, url: full});
    if (thumb && thumb !== full) appChecks.push({what: `${key} thumb`, url: thumb});
}
console.log(`1. App URLs: ${rows.length} rows · ${fromStorage} served from Storage · ${rows.length - fromStorage} from external_url`);
await mapPool(appChecks, 8, head);
console.log(`   HEAD ${appChecks.length} URLs → ${failures.length ? `${failures.length} failed` : "all 200"}`);

// 2. Spot checks against the manifest.
const manifest = loadManifest(job.manifest, job.name, job.bucket);
const stored = new Set(rows.flatMap((r) => [r.storage_path, r.thumb_storage_path]).filter((p): p is string => !!p));
const candidates = Object.keys(manifest.objects).filter((p) => stored.has(p));
const picked = [...candidates].sort(() => Math.random() - 0.5).slice(0, Math.min(sample, candidates.length));
if (picked.length) {
    const results = await verifyObjects(Object.fromEntries(picked.map((p) => [p, manifest.objects[p]])), {
        mode: "full",
        publicUrl: supabaseTarget(supabase, job.bucket).publicUrl,
        retries: job.retries,
    });
    for (const r of results.filter((r) => !r.ok)) failures.push(`${r.path}: ${r.problem}`);
    console.log(`2. Spot checks: ${picked.length} of ${candidates.length} Storage objects → ${results.filter((r) => r.ok).length} match the manifest (bytes, sha256, dimensions)`);
    for (const p of picked.slice(0, 3)) {
        const e = manifest.objects[p];
        console.log(`   e.g. ${p}  ${e.width}×${e.height} ${e.bytes} B (original ${e.sourceWidth}×${e.sourceHeight} ${e.sourceBytes} B)`);
    }
} else {
    console.log(`2. Spot checks: skipped (${stored.size ? "no manifest entries for the stored paths" : "no rows on Storage yet"})`);
    if (stored.size) failures.push("rows point at Storage paths the manifest doesn't know");
}

// 3. Rollback path.
if (legacy) {
    const before = failures.length;
    const legacyChecks: Check[] = rows.flatMap((row) => [
        row.external_url ? {what: `${sourceKey(row)} external_url`, url: row.external_url} : null,
        row.thumb_external_url ? {what: `${sourceKey(row)} thumb_external_url`, url: row.thumb_external_url} : null,
    ]).filter((c): c is Check => c !== null);
    await mapPool(legacyChecks, 4, head);
    console.log(`3. Rollback path: HEAD ${legacyChecks.length} external URLs → ${failures.length - before ? `${failures.length - before} failed` : "all 200"}`);
} else {
    console.log("3. Rollback path: skipped (add --legacy to HEAD every external_url)");
}

for (const f of failures.slice(0, 30)) console.log(`   ✖ ${f}`);
if (failures.length > 30) console.log(`   … +${failures.length - 30} more`);
const complete = fromStorage === rows.length;
console.log(`\n${failures.length ? `✖ ${failures.length} problem(s)` : "✓ All checks passed"}${complete ? " · every image is served from Storage" : ` · ${rows.length - fromStorage} image(s) not on Storage yet`}`);
process.exit(failures.length ? 1 : 0);
