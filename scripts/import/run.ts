// `npm run import:cars` — imports src/data/car-models.json into the `diecast` schema.
//
//   npm run import:cars                      dry run (default): exact counts, then rolled back
//   npm run import:cars -- --apply           write, in ONE transaction (all or nothing)
//   npm run import:cars -- --plan            only build + print the payload plan, no DB call
//   npm run import:cars -- --fail-after=models   (with or without --apply) inject an error after a step
//
// Needs VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local. The service key bypasses RLS,
// so this script only ever calls diecast.import_collection — it runs nowhere but your machine.
import {existsSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";

import {loadImportInputs} from "./config.ts";
import {buildImport} from "./transform.ts";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const planOnly = args.has("--plan");
const failAfter = process.argv.find((a) => a.startsWith("--fail-after="))?.split("=")[1] ?? null;

const {models, config} = loadImportInputs();
const publicDir = new URL("../../public", import.meta.url);
const plan = buildImport(models, config, (path) => existsSync(new URL(`.${encodeURI(path)}`, `${publicDir.href}/`)));
const {payload, warnings, errors} = plan;

console.log(
    `Planned: models ${payload.models.length} · brands ${payload.brands.length} · manufacturers ${payload.manufacturers.length}` +
    ` · categories ${new Set(payload.models.map((m) => m.category_slug)).size} · colors ${payload.colors.length}` +
    ` · drivers ${payload.drivers.length} · model_colors ${payload.model_colors.length} · images ${payload.model_images.length}`,
);
for (const w of warnings) {
    console.log(`  ⚠ [${w.code}] ${w.message}${w.ids ? `\n      ${w.ids.slice(0, 12).join(", ")}${w.ids.length > 12 ? ` … +${w.ids.length - 12}` : ""}` : ""}`);
}
if (errors.length) {
    for (const e of errors) console.error(`  ✖ [${e.code}] ${e.message}${e.ids ? ` — ${e.ids.join(", ")}` : ""}`);
    console.error(`\n✖ ${errors.length} error(s): nothing was sent to the database.`);
    process.exit(1);
}
if (planOnly) process.exit(0);

const url = process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
    console.error("✖ VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
    process.exit(1);
}
const role = (() => {
    if (serviceKey.startsWith("sb_secret_")) return "service_role";
    try {
        return JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64url").toString()).role;
    } catch {
        return "unknown";
    }
})();
if (role !== "service_role") {
    console.error(`✖ SUPABASE_SERVICE_ROLE_KEY is not a service-role key (role: ${role}).`);
    process.exit(1);
}

const supabase = createClient(url, serviceKey, {db: {schema: "diecast"}, auth: {persistSession: false, autoRefreshToken: false}});
console.log(`\n${apply ? "APPLYING" : "DRY RUN (rolled back)"} → ${url}${failAfter ? ` · injecting failure after "${failAfter}"` : ""}`);

const {data, error} = await supabase.rpc("import_collection", {
    p_payload: payload,
    p_dry_run: !apply,
    p_fail_after: failAfter,
});

if (error) {
    console.error(`✖ Import failed — the transaction was rolled back, nothing changed.\n  ${error.message}${error.hint ? `\n  hint: ${error.hint}` : ""}`);
    process.exit(1);
}

type Step = {inserted?: number; updated?: number; deleted?: number};
const result = data as Record<string, Step> & {totals: Record<string, number>; models_not_in_payload: string[]; dry_run: boolean};
const steps = ["brands", "manufacturers", "colors", "drivers", "models", "model_colors", "model_images"];
console.log("\n  table           inserted  updated  deleted   total after");
for (const step of steps) {
    const s = result[step] ?? {};
    console.log(`  ${step.padEnd(15)} ${String(s.inserted ?? 0).padStart(8)} ${String(s.updated ?? "–").padStart(8)} ${String(s.deleted ?? "–").padStart(8)} ${String(result.totals[step] ?? "").padStart(12)}`);
}
console.log(`  ${"categories".padEnd(15)} ${"(seeded)".padStart(8)} ${"".padStart(8)} ${"".padStart(8)} ${String(result.totals.categories).padStart(12)}`);
if (result.models_not_in_payload.length) {
    console.log(`  ⚠ ${result.models_not_in_payload.length} model(s) in the DB but not in the JSON (left untouched): ${result.models_not_in_payload.join(", ")}`);
}

const changes = steps.reduce((n, s) => n + (result[s]?.inserted ?? 0) + (result[s]?.updated ?? 0) + (result[s]?.deleted ?? 0), 0);
console.log(
    `\n${result.dry_run ? "Dry run" : "Imported"}: models ${result.totals.models} · manufacturers ${result.totals.manufacturers}` +
    ` · brands ${result.totals.brands} · categories ${result.totals.categories} · colors ${result.totals.colors}` +
    ` · drivers ${result.totals.drivers} · model_colors ${result.totals.model_colors} · images ${result.totals.model_images}` +
    ` · changes ${changes} · Warnings: ${warnings.length} · Failed: 0`,
);
if (result.dry_run) console.log("Nothing was written. Re-run with --apply to import.");
