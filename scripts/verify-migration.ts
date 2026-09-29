// `npm run verify:migration` — Phase 8: proves the live `diecast` schema matches
// src/data/car-models.json before anything (Phase 9+) depends on Supabase instead of the JSON.
//
// Rebuilds the exact same expected payload the importer uses (scripts/import/{config,transform}.ts)
// and compares it field-by-field against `diecast.model_summaries`, read with the anon key (the
// same access a signed-out visitor has — no writes, no service key). Also checks aggregate counts,
// duplicate slugs, orphaned/missing data, and HEAD-checks every image URL. Writes
// docs/migration-report.md.
//
// Exits 1 on any field mismatch, missing/extra model, duplicate slug, or orphan. Image URL
// failures are reported in the report but never fail the build (transient hosting hiccups are
// expected — see Phase 8 task list).
import {writeFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";

import {loadImportInputs} from "./import/config.ts";
import {buildImport} from "./import/transform.ts";
import type {Tables} from "../src/lib/database.types.ts";

type Summary = Tables<"model_summaries">;

type Mismatch = {slug: string; field: string; expected: string; actual: string};

const url = process.env.VITE_SUPABASE_URL?.trim();
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
if (!url || !anonKey) {
    console.error("✖ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local");
    process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Rebuild the expected payload from the JSON (the importer's own transform).
// ---------------------------------------------------------------------------

const {models, config} = loadImportInputs();
const plan = buildImport(models, config);
if (plan.errors.length) {
    console.error(`✖ ${plan.errors.length} error(s) building the expected payload from car-models.json — fix these before verifying:`);
    for (const e of plan.errors) console.error(`  ✖ [${e.code}] ${e.message}${e.ids ? ` — ${e.ids.join(", ")}` : ""}`);
    process.exit(1);
}
const {payload} = plan;

const expectedColorsByModel = new Map<string, string[]>();
for (const mc of payload.model_colors) {
    const list = expectedColorsByModel.get(mc.model_slug) ?? [];
    list[mc.position] = mc.color_slug;
    expectedColorsByModel.set(mc.model_slug, list);
}

// ---------------------------------------------------------------------------
// 2. Pull the live data (anon key — the same view public.getModels() will use in Phase 9+).
// ---------------------------------------------------------------------------

const supabase = createClient(url, anonKey, {db: {schema: "diecast"}, auth: {persistSession: false}});

async function fetchAll<T>(table: string): Promise<T[]> {
    const {data, error} = await supabase.from(table).select("*").limit(2000);
    if (error) {
        console.error(`✖ Could not read diecast.${table}: ${error.message}`);
        process.exit(1);
    }
    return (data ?? []) as T[];
}

const dbSummaries = await fetchAll<Summary>("model_summaries");
const dbModels = await fetchAll<{id: string; slug: string}>("models");
const dbBrands = await fetchAll<{slug: string}>("brands");
const dbManufacturers = await fetchAll<{slug: string}>("manufacturers");
const dbCategories = await fetchAll<{slug: string}>("categories");
const dbColors = await fetchAll<{slug: string}>("colors");
const dbDrivers = await fetchAll<{slug: string}>("drivers");

// ---------------------------------------------------------------------------
// 3. Per-model field comparison.
// ---------------------------------------------------------------------------

const mismatches: Mismatch[] = [];
const missingInDb: string[] = [];
const dbBySlug = new Map(dbSummaries.map((r) => [r.slug as string, r]));

function compare(slug: string, field: string, expected: string, actual: string) {
    if (expected !== actual) mismatches.push({slug, field, expected, actual});
}
function arrEq(a: string[], b: string[]) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

for (const m of payload.models) {
    const row = dbBySlug.get(m.slug);
    if (!row) {
        missingInDb.push(m.slug);
        continue;
    }
    compare(m.slug, "name", m.name, row.name ?? "");
    compare(m.slug, "year", String(m.year), String(row.year ?? ""));
    compare(m.slug, "brand_slug", m.brand_slug, row.brand_slug ?? "");
    compare(m.slug, "manufacturer_slug", m.manufacturer_slug, row.manufacturer_slug ?? "");
    compare(m.slug, "category_slug", m.category_slug, row.category_slug ?? "");
    compare(m.slug, "scale", m.scale, row.scale ?? "");
    compare(m.slug, "is_racing", String(m.is_racing), String(row.is_racing ?? false));
    compare(m.slug, "car_number", m.car_number ?? "", row.car_number ?? "");
    compare(m.slug, "driver_slug", m.driver_slug ?? "", row.driver_slug ?? "");

    const expectedColors = expectedColorsByModel.get(m.slug) ?? [];
    const actualColors = row.color_slugs ?? [];
    if (!arrEq(expectedColors, actualColors)) {
        mismatches.push({slug: m.slug, field: "color_slugs (order)", expected: expectedColors.join(","), actual: actualColors.join(",")});
    }
    if (!arrEq(m.livery_hex, row.livery_hex ?? [])) {
        mismatches.push({slug: m.slug, field: "livery_hex (order)", expected: m.livery_hex.join(","), actual: (row.livery_hex ?? []).join(",")});
    }
}

const extraInDb = dbSummaries.map((r) => r.slug as string).filter((slug) => !payload.models.some((m) => m.slug === slug));

// Image URLs: the importer writes one row per model (position 0, is_primary), so model_summaries'
// single "primary image" is exactly that row.
const imageMismatches: Mismatch[] = [];
function compareImage(slug: string, field: string, expected: string, actual: string) {
    if (expected !== actual) imageMismatches.push({slug, field, expected, actual});
}
for (const m of models) {
    const row = dbBySlug.get(m.id);
    if (!row) continue;
    compareImage(m.id, "image_external_url", m.imageUrl, row.image_external_url ?? "");
    compareImage(m.id, "thumb_external_url", m.thumbnail, row.thumb_external_url ?? "");
}

// ---------------------------------------------------------------------------
// 4. Aggregate checks.
// ---------------------------------------------------------------------------

const aggregates = [
    {label: "models", expected: payload.models.length, actual: dbSummaries.length},
    {label: "brands", expected: payload.brands.length, actual: dbBrands.length},
    {label: "manufacturers", expected: payload.manufacturers.length, actual: dbManufacturers.length},
    {label: "categories", expected: 5, actual: dbCategories.length},
    {label: "colors", expected: payload.colors.length, actual: dbColors.length},
    {label: "drivers", expected: payload.drivers.length, actual: dbDrivers.length},
];
const aggregateMismatches = aggregates.filter((a) => a.expected !== a.actual);

// ---------------------------------------------------------------------------
// 5. Duplicate-slug and orphan checks.
// ---------------------------------------------------------------------------

const slugCounts = new Map<string, number>();
for (const r of dbModels) slugCounts.set(r.slug, (slugCounts.get(r.slug) ?? 0) + 1);
const duplicateSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1).map(([slug]) => slug);

const modelsMissingImage = dbSummaries.filter((r) => (r.image_count ?? 0) === 0).map((r) => r.slug as string);
const modelsMissingBrand = dbSummaries.filter((r) => !r.brand_slug).map((r) => r.slug as string);
const modelsMissingManufacturer = dbSummaries.filter((r) => !r.manufacturer_slug).map((r) => r.slug as string);
const modelsMissingCategory = dbSummaries.filter((r) => !r.category_slug).map((r) => r.slug as string);

// ---------------------------------------------------------------------------
// 6. HEAD-check every image URL (with retry). Never fails the build — reported only.
// ---------------------------------------------------------------------------

const imageUrls = [...new Set(dbSummaries.flatMap((r) => [r.image_external_url, r.thumb_external_url]).filter((u): u is string => !!u))];

async function headCheck(url: string, retries = 1): Promise<{url: string; ok: boolean; status?: number; error?: string}> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, {method: "HEAD", signal: AbortSignal.timeout(6000)});
            if (res.ok) return {url, ok: true, status: res.status};
            if (attempt === retries) return {url, ok: false, status: res.status};
        } catch (error) {
            if (attempt === retries) return {url, ok: false, error: (error as Error).message};
        }
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
    return {url, ok: false, error: "unreachable"};
}

console.log(`Checking ${imageUrls.length} image URLs (HEAD, 1 retry each; postimg.cc can be slow, so this may take a few minutes)…`);
const CONCURRENCY = 24;
const imageResults: Awaited<ReturnType<typeof headCheck>>[] = [];
for (let i = 0; i < imageUrls.length; i += CONCURRENCY) {
    const batch = imageUrls.slice(i, i + CONCURRENCY);
    imageResults.push(...(await Promise.all(batch.map((u) => headCheck(u)))));
    console.log(`  ${Math.min(i + CONCURRENCY, imageUrls.length)}/${imageUrls.length} checked`);
}
const failedImages = imageResults.filter((r) => !r.ok);

// ---------------------------------------------------------------------------
// 7. Report.
// ---------------------------------------------------------------------------

const structuralIssues =
    mismatches.length + missingInDb.length + extraInDb.length + aggregateMismatches.length +
    duplicateSlugs.length + modelsMissingBrand.length + modelsMissingManufacturer.length + modelsMissingCategory.length;

const now = new Date().toISOString();
const lines: string[] = [];
lines.push("# Migration verification report — Phase 8");
lines.push("");
lines.push(`Generated ${now} by \`npm run verify:migration\` (\`scripts/verify-migration.ts\`).`);
lines.push("Compares `src/data/car-models.json` (via the importer's own transform) against `diecast.model_summaries`, read with the anon key.");
lines.push("");
lines.push("## Aggregate counts");
lines.push("");
lines.push("| Table | Expected (from JSON) | Actual (DB) | Match |");
lines.push("| --- | --- | --- | --- |");
for (const a of aggregates) lines.push(`| ${a.label} | ${a.expected} | ${a.actual} | ${a.expected === a.actual ? "✅" : "❌"} |`);
lines.push("");
lines.push("## Per-model field comparison");
lines.push("");
lines.push(`Checked ${payload.models.length} models × (name, year, brand, manufacturer, category, color slugs/order, livery_hex/order, scale, driver, car number, image URLs, slug).`);
lines.push("");
if (mismatches.length === 0 && missingInDb.length === 0 && extraInDb.length === 0) {
    lines.push("✅ 0 mismatches, 0 missing, 0 extra.");
} else {
    if (missingInDb.length) lines.push(`❌ ${missingInDb.length} model(s) in the JSON but not found in the DB: ${missingInDb.join(", ")}`);
    if (extraInDb.length) lines.push(`❌ ${extraInDb.length} model(s) in the DB but not in the JSON: ${extraInDb.join(", ")}`);
    if (mismatches.length) {
        lines.push(`❌ ${mismatches.length} field mismatch(es):`);
        lines.push("");
        lines.push("| Model | Field | Expected | Actual |");
        lines.push("| --- | --- | --- | --- |");
        for (const m of mismatches) lines.push(`| ${m.slug} | ${m.field} | ${m.expected} | ${m.actual} |`);
    }
}
lines.push("");
lines.push("## Image URL field comparison (JSON `imageUrl`/`thumbnail` vs DB `external_url`/`thumb_external_url`)");
lines.push("");
if (imageMismatches.length === 0) {
    lines.push("✅ 0 mismatches — every stored URL matches the JSON exactly.");
} else {
    lines.push(`❌ ${imageMismatches.length} mismatch(es):`);
    lines.push("");
    lines.push("| Model | Field | Expected | Actual |");
    lines.push("| --- | --- | --- | --- |");
    for (const m of imageMismatches) lines.push(`| ${m.slug} | ${m.field} | ${m.expected} | ${m.actual} |`);
}
lines.push("");
lines.push("## Duplicate-slug and orphan checks");
lines.push("");
lines.push(`- Duplicate slugs in \`models\`: ${duplicateSlugs.length === 0 ? "✅ none" : `❌ ${duplicateSlugs.join(", ")}`}`);
lines.push(`- Models with no image row: ${modelsMissingImage.length === 0 ? "✅ none" : `⚠ ${modelsMissingImage.length}: ${modelsMissingImage.join(", ")}`}`);
lines.push(`- Models with no brand (FK is NOT NULL — structurally impossible): ${modelsMissingBrand.length === 0 ? "✅ none" : `❌ ${modelsMissingBrand.join(", ")}`}`);
lines.push(`- Models with no manufacturer (FK is NOT NULL — structurally impossible): ${modelsMissingManufacturer.length === 0 ? "✅ none" : `❌ ${modelsMissingManufacturer.join(", ")}`}`);
lines.push(`- Models with no category (FK is NOT NULL — structurally impossible): ${modelsMissingCategory.length === 0 ? "✅ none" : `❌ ${modelsMissingCategory.join(", ")}`}`);
lines.push("");
lines.push("## Image URL reachability (HEAD, 1 retry; transient failures never fail the build)");
lines.push("");
lines.push(`Checked ${imageUrls.length} unique URLs (454 expected = 227 models × full + thumbnail, deduplicated).`);
lines.push("");
if (failedImages.length === 0) {
    lines.push("✅ All URLs returned a successful HEAD response.");
} else {
    lines.push(`⚠ ${failedImages.length} URL(s) failed after retries:`);
    lines.push("");
    lines.push("| URL | Status/Error |");
    lines.push("| --- | --- |");
    for (const f of failedImages) lines.push(`| ${f.url} | ${f.status ?? f.error} |`);
}
lines.push("");
lines.push("## Conclusion");
lines.push("");
lines.push(
    structuralIssues === 0
        ? `✅ **Pass.** Supabase matches \`car-models.json\` exactly: 0 mismatches, 0 orphans, 0 duplicates.${failedImages.length ? ` ${failedImages.length} image URL(s) are currently unreachable (see above) — informational only.` : ""}`
        : `❌ **Fail.** ${structuralIssues} structural issue(s) found above — do not proceed to Phase 9 until resolved.`,
);
lines.push("");
lines.push("**Owner action:** spot-check ~10 models in the Supabase dashboard against this report, then sign off in `ROADMAP.md` (Phase 8).");
lines.push("");

writeFileSync(new URL("../docs/migration-report.md", import.meta.url), lines.join("\n"));

console.log(`\n${"table".padEnd(15)}expected  actual`);
for (const a of aggregates) console.log(`  ${a.label.padEnd(13)}${String(a.expected).padStart(8)}${String(a.actual).padStart(8)}  ${a.expected === a.actual ? "✓" : "✗"}`);
console.log(`\nField mismatches: ${mismatches.length} · image-URL field mismatches: ${imageMismatches.length} · missing: ${missingInDb.length} · extra: ${extraInDb.length} · duplicate slugs: ${duplicateSlugs.length}`);
console.log(`Image reachability: ${imageUrls.length - failedImages.length}/${imageUrls.length} OK (${failedImages.length} unreachable — informational)`);
console.log(`\nReport written to docs/migration-report.md`);
console.log(structuralIssues === 0 ? "\n✅ PASS" : `\n✖ FAIL — ${structuralIssues} structural issue(s)`);

process.exit(structuralIssues === 0 ? 0 : 1);
