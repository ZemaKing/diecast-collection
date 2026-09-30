// `npm run images:flip` — points model_images at the uploaded Storage objects, only after checks.
//
//   npm run images:flip                         dry run: plan + verify every object + exact counts, rolled back
//   npm run images:flip -- --apply              the same, then flip all rows in ONE transaction
//   npm run images:flip -- --rollback [--apply] clear storage_path/thumb_storage_path → back to external_url
//
// Before any flip, every object is downloaded from its public URL and compared with the manifest
// (sha256, size, dimensions). One failure blocks the whole flip. external_url is never touched —
// it stays the rollback path. Needs VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local).
import {loadManifest} from "../images/manifest.ts";
import {createServiceClient, supabaseTarget} from "../images/supabase-target.ts";
import {verifyObjects} from "../images/verify.ts";
import job, {loadImageRows} from "./job.ts";
import {planFlip, planRollback} from "./plan.ts";

const args = new Set(process.argv.slice(2));
const unknown = [...args].filter((a) => !["--apply", "--rollback"].includes(a));
if (unknown.length) fail(`Unknown argument(s): ${unknown.join(" ")}`);
const apply = args.has("--apply");
const rollback = args.has("--rollback");

function fail(message: string): never {
    console.error(`✖ ${message}`);
    process.exit(1);
}

const supabase = createServiceClient();
const rows = await loadImageRows(supabase);
const manifest = loadManifest(job.manifest, job.name, job.bucket);
const plan = rollback ? planRollback(rows) : planFlip(job, rows, manifest);

console.log(`${rollback ? "ROLLBACK to external_url" : "FLIP to Storage"} — ${apply ? "APPLYING" : "DRY RUN (rolled back)"}`);
console.log(`  model_images rows ${rows.length} · to change ${plan.rows.length} · already done ${plan.unchanged} · problems ${plan.problems.length}`);
if (plan.problems.length) {
    for (const p of plan.problems.slice(0, 20)) console.log(`  ✖ ${p}`);
    if (plan.problems.length > 20) console.log(`  … +${plan.problems.length - 20} more`);
    fail(rollback ? "Some rows can't be rolled back — nothing was changed." : "Not every image is uploaded — run `npm run images:migrate -- --apply` first. Nothing was changed.");
}

if (!rollback) {
    const objects = Object.keys(plan.objects).length;
    console.log(`\nVerifying ${objects} Storage object(s) against the manifest (download + sha256 + dimensions)…`);
    const results = await verifyObjects(plan.objects, {mode: "full", publicUrl: supabaseTarget(supabase, job.bucket).publicUrl, retries: job.retries});
    const failed = results.filter((r) => !r.ok);
    for (const r of failed) console.log(`  ✖ ${r.path}: ${r.problem}`);
    if (failed.length) fail(`${failed.length}/${objects} object(s) failed verification — nothing was changed.`);
    console.log(`  ✓ ${objects}/${objects} objects verified`);
}

if (!plan.rows.length) {
    console.log("\nNothing to change.");
    process.exit(0);
}

const {data, error} = await supabase.schema("diecast").rpc("set_image_storage", {p_rows: plan.rows, p_dry_run: !apply});
if (error) fail(`set_image_storage failed — the transaction was rolled back, nothing changed.\n  ${error.message}`);

const result = data as {rows: number; updated: number; on_storage: number; external_only: number; total: number; dry_run: boolean};
console.log(`\n${result.dry_run ? "Dry run" : "Done"}: updated ${result.updated}/${result.rows} · on Storage ${result.on_storage}/${result.total} · external only ${result.external_only}`);
if (result.dry_run) console.log(`Nothing was written. Re-run with --apply to ${rollback ? "roll back" : "flip"}.`);
else if (!rollback) console.log("Next: npm run images:verify");
