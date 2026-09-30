// `npm run verify:stats` — ROADMAP Phase 23: cross-checks every number on the Statistics page
// against the database.
//
// The page computes its numbers in the browser from `model_summaries` (getCollectionBreakdown()
// in src/services/stats.ts). This script runs that exact code on the live view, then counts each
// number again *independently* — one `count(*)` per brand / manufacturer / category / color /
// decade / racing flag, straight on the base tables (`models`, `model_colors`), never through the
// view — and fails if any pair differs. Each count is the PostgREST form of the queries in
// supabase/checks/statistics.sql, which can be pasted into the dashboard's SQL editor as well.
//
// Anon key only (what a signed-out visitor sees: published models). Read-only.
import {createClient} from "@supabase/supabase-js";

import type {Tables} from "../src/lib/database.types.ts";
import {mapModelSummary} from "../src/services/mappers.ts";
import {getCollectionBreakdown, getCollectionStats} from "../src/services/stats.ts";

const url = process.env.VITE_SUPABASE_URL?.trim();
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
if (!url || !anonKey) {
    console.error("✖ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local");
    process.exit(1);
}

const supabase = createClient(url, anonKey, {db: {schema: "diecast"}, auth: {persistSession: false}});

async function rows<T>(table: string, columns = "*"): Promise<T[]> {
    const {data, error} = await supabase.from(table).select(columns).limit(5000);
    if (error) throw new Error(`diecast.${table}: ${error.message}`);
    return data as T[];
}

// The WHERE clause of one count: equality on a column, and/or a [from, to) year range.
type Where = {column?: string; value?: string | boolean; yearFrom?: number; yearTo?: number};

// SELECT count(*) FROM diecast.models WHERE is_published AND <where>
async function countModels({column, value, yearFrom, yearTo}: Where = {}): Promise<number> {
    let query = supabase.from("models").select("id", {count: "exact", head: true}).eq("is_published", true);
    if (column !== undefined && value !== undefined) query = query.eq(column, value);
    if (yearFrom !== undefined) query = query.gte("year", yearFrom);
    if (yearTo !== undefined) query = query.lt("year", yearTo);
    const {count, error} = await query;
    if (error || count === null) throw new Error(`count(models): ${error?.message ?? "no count"}`);
    return count;
}

// SELECT count(*) FROM diecast.model_colors mc JOIN diecast.models m ON m.id = mc.model_id
// WHERE m.is_published AND mc.color_id = $1
async function countModelColors(colorId: string): Promise<number> {
    const {count, error} = await supabase
        .from("model_colors")
        .select("model_id, models!inner(is_published)", {count: "exact", head: true})
        .eq("color_id", colorId)
        .eq("models.is_published", true);
    if (error || count === null) throw new Error(`count(model_colors): ${error?.message ?? "no count"}`);
    return count;
}

type Lookup = {id: string; slug: string; name: string};
type Check = {group: string; label: string; app: number; db: number};

async function main() {
    const summaries = (await rows<Tables<"model_summaries">>("model_summaries")).map(mapModelSummary);
    const stats = getCollectionStats(summaries);
    const breakdown = getCollectionBreakdown(summaries);

    const [brands, manufacturers, categories, colors] = await Promise.all(
        ["brands", "manufacturers", "categories", "colors"].map((t) => rows<Lookup>(t, "id, slug, name")),
    );
    const checks: Check[] = [];
    const add = (group: string, label: string, app: number, db: number) => checks.push({group, label, app, db});

    // Totals — distinct values among published models.
    type ModelKeys = Pick<Tables<"models">, "brand_id" | "manufacturer_id" | "category_id" | "is_published">;
    const published = (await rows<ModelKeys>("models", "brand_id, manufacturer_id, category_id, is_published")).filter((m) => m.is_published);
    add("Totals", "models", stats.totalModels, await countModels());
    add("Totals", "brands", stats.totalBrands, new Set(published.map((m) => m.brand_id)).size);
    add("Totals", "manufacturers", stats.totalManufacturers, new Set(published.map((m) => m.manufacturer_id)).size);
    add("Totals", "categories", stats.totalCategories, new Set(published.map((m) => m.category_id)).size);

    // Per brand / manufacturer / category — every lookup row, so one the page is missing (or
    // shows with a stale count) shows up as a mismatch, not silently.
    const perLookup = async (group: string, lookups: Lookup[], column: string, app: Map<string, number>) => {
        for (const l of lookups) {
            const db = await countModels({column, value: l.id});
            if (db > 0 || app.has(l.slug)) add(group, l.name, app.get(l.slug) ?? 0, db);
        }
    };
    await perLookup("Brands", brands, "brand_id", new Map(breakdown.brands.map((e) => [e.slug, e.count])));
    await perLookup("Manufacturers", manufacturers, "manufacturer_id", new Map(breakdown.manufacturers.map((e) => [e.slug, e.count])));
    await perLookup("Categories", categories, "category_id", new Map(breakdown.categories.map((e) => [e.slug, e.count])));

    const appColors = new Map(breakdown.colors.map((c) => [c.slug, c.count]));
    for (const c of colors) {
        const db = await countModelColors(c.id);
        if (db > 0 || appColors.has(c.slug)) add("Colors", c.name, appColors.get(c.slug) ?? 0, db);
    }

    for (const d of breakdown.decades) {
        add("Decades", d.label, d.count, await countModels({yearFrom: d.decade, yearTo: d.decade + 10}));
    }
    const first = breakdown.decades[0]?.decade;
    const last = breakdown.decades.at(-1)?.decade;
    if (first !== undefined && last !== undefined) {
        add("Decades", `before ${first}s`, 0, await countModels({yearTo: first}));
        add("Decades", `after ${last}s`, 0, await countModels({yearFrom: last + 10}));
    }

    add("Racing vs road", "racing", breakdown.racing.racing, await countModels({column: "is_racing", value: true}));
    add("Racing vs road", "road", breakdown.racing.road, await countModels({column: "is_racing", value: false}));

    const failed = checks.filter((c) => c.app !== c.db);
    let group = "";
    for (const c of checks) {
        if (c.group !== group) console.log(`\n${(group = c.group)}`);
        console.log(`  ${c.app === c.db ? "✓" : "✖"} ${c.label.padEnd(18)} page ${String(c.app).padStart(4)}   db ${String(c.db).padStart(4)}`);
    }
    console.log(`\n${checks.length - failed.length}/${checks.length} numbers match.`);
    if (failed.length) {
        console.error(`✖ ${failed.length} mismatch(es): ${failed.map((c) => `${c.group}/${c.label}`).join(", ")}`);
        process.exit(1);
    }
}

main().catch((error: unknown) => {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
