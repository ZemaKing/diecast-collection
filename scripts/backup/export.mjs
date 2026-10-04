// `npm run backup:export` (ROADMAP Phase 37) — read-only export of the whole `diecast` schema
// to a git-ignored `backups/<timestamp>/` folder: one JSON file per table (every column, every
// row, drafts and private notes included), the Storage file lists of both buckets, and a
// manifest with row counts and checksums. `-- --photos` also downloads every Storage object
// (~32 MB; counts against the Free plan's egress). Restore notes: scripts/backup/README.md.
//
// Needs SUPABASE_SERVICE_ROLE_KEY (RLS hides drafts, private notes and admin_users from anyone
// else). It only ever sends GET requests and Storage "list" calls — it never writes.
import {createHash} from "node:crypto";
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";

// Parents before children, so a restore can insert the files in this order.
const TABLES = [
    "categories", "colors", "brands", "manufacturers", "drivers", "tags",
    "models", "model_colors", "model_images", "model_tags", "model_private_notes", "admin_users",
];
const BUCKETS = ["model-images", "lookup-logos"];
const PAGE = 1000;

const url = process.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
    console.error("✖ VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local).");
    process.exit(1);
}
const withPhotos = process.argv.includes("--photos");
const headers = {apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "diecast"};

async function request(input, init) {
    const res = await fetch(input, {...init, signal: AbortSignal.timeout(30_000)});
    if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${input} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res;
}

async function readTable(table) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
        const res = await request(`${url}/rest/v1/${table}?select=*`, {
            headers: {...headers, Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items"},
        });
        const page = await res.json();
        rows.push(...page);
        if (page.length < PAGE) return rows;
    }
}

// Storage lists one folder level at a time; entries without an id are folders.
async function listBucket(bucket, prefix = "") {
    const files = [];
    for (let offset = 0; ; offset += PAGE) {
        const res = await request(`${url}/storage/v1/object/list/${bucket}`, {
            method: "POST",
            headers: {...headers, "Content-Type": "application/json"},
            body: JSON.stringify({prefix, limit: PAGE, offset, sortBy: {column: "name", order: "asc"}}),
        });
        const entries = await res.json();
        for (const entry of entries) {
            const full = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.id) files.push({path: full, bytes: entry.metadata?.size ?? null, updatedAt: entry.updated_at});
            else files.push(...await listBucket(bucket, full));
        }
        if (entries.length < PAGE) return files;
    }
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join("backups", stamp);
await mkdir(outDir, {recursive: true});

const manifest = {createdAt: new Date().toISOString(), project: url, schema: "diecast", tables: {}, buckets: {}};

for (const table of TABLES) {
    const rows = await readTable(table);
    const json = JSON.stringify(rows, null, 2);
    await writeFile(path.join(outDir, `${table}.json`), json);
    manifest.tables[table] = {rows: rows.length, sha256: sha256(json)};
    console.log(`✓ ${table.padEnd(20)} ${rows.length} rows`);
}

for (const bucket of BUCKETS) {
    const files = await listBucket(bucket);
    await writeFile(path.join(outDir, `storage-${bucket}.json`), JSON.stringify(files, null, 2));
    const bytes = files.reduce((sum, f) => sum + (f.bytes ?? 0), 0);
    manifest.buckets[bucket] = {files: files.length, bytes, downloaded: false};
    console.log(`✓ ${`${bucket} (Storage)`.padEnd(20)} ${files.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);

    if (withPhotos) {
        for (const [i, file] of files.entries()) {
            const res = await request(`${url}/storage/v1/object/${bucket}/${file.path}`, {headers});
            const target = path.join(outDir, "storage", bucket, ...file.path.split("/"));
            await mkdir(path.dirname(target), {recursive: true});
            await writeFile(target, Buffer.from(await res.arrayBuffer()));
            if ((i + 1) % 100 === 0) console.log(`  … ${i + 1}/${files.length}`);
        }
        manifest.buckets[bucket].downloaded = true;
        console.log(`  ✓ downloaded ${files.length} files`);
    }
}

await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nBackup written to ${outDir}${withPhotos ? "" : " (Storage file lists only; add -- --photos for the files)"}`);
console.log("It contains private notes and admin user ids: keep it local, never commit it (backups/ is git-ignored).");
