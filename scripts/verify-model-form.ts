// `npm run verify:model-form` — ROADMAP Phase 25: "editing an imported model changes nothing it
// shouldn't", proven on every model in the database, without writing anything.
//
// For each model this runs the admin form's exact code path — the details read mapped by
// mapModel(), modelToFormValues(), validateModelForm(), toSavePayload() — and submits the result to
// diecast.save_model() as a DRY RUN (the function executes the real statements, reports, then
// rolls itself back). Opening a model in the form and pressing Save without touching anything must:
//   - validate (every stored model is editable as-is), and
//   - report `changed: false` (every value round-trips exactly, colors in order).
// Plus two controls: a real edit is detected (`changed: true`), and neither dry run left a trace.
//
// Signs in as the admin from .env.local (RLS_ADMIN_*) — the same rights the form has. Needs
// migration 20260930150000_diecast_save_model.sql applied.
import {createClient} from "@supabase/supabase-js";

import type {Database} from "../src/lib/database.types.ts";
import {mapModel, type ModelColorRow, type ModelWithRelations} from "../src/services/mappers.ts";
import {modelToFormValues, toSavePayload, validateModelForm} from "../src/utils/model-form.ts";

const env = process.env;
const url = env.VITE_SUPABASE_URL?.trim();
const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
if (!url || !anonKey || !env.RLS_ADMIN_EMAIL || !env.RLS_ADMIN_PASSWORD) {
    console.error("✖ VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, RLS_ADMIN_EMAIL and RLS_ADMIN_PASSWORD must be set in .env.local");
    process.exit(1);
}

const supabase = createClient<Database, "diecast">(url, anonKey, {db: {schema: "diecast"}, auth: {persistSession: false}});
const {error: signInError} = await supabase.auth.signInWithPassword({email: env.RLS_ADMIN_EMAIL, password: env.RLS_ADMIN_PASSWORD});
if (signInError) {
    console.error(`✖ Admin sign-in failed: ${signInError.message}`);
    process.exit(1);
}

const {data: modelRows, error: modelsError} = await supabase
    .from("models")
    .select("*, brand:brands(*), manufacturer:manufacturers(*), category:categories(*), driver:drivers(*)")
    .order("slug")
    .limit(5000);
const {data: colorRows, error: colorsError} = await supabase
    .from("model_colors")
    .select("model_id, position, color:colors(*)")
    .limit(10000);
if (modelsError || colorsError || !modelRows || !colorRows) {
    console.error(`✖ Read failed: ${modelsError?.message ?? colorsError?.message}`);
    process.exit(1);
}

const colorsByModel = new Map<string, ModelColorRow[]>();
for (const row of colorRows as unknown as (ModelColorRow & {model_id: string})[]) {
    colorsByModel.set(row.model_id, [...(colorsByModel.get(row.model_id) ?? []), row]);
}

const currentYear = new Date().getFullYear();
const problems: string[] = [];
let unchanged = 0;

async function dryRunSave(payload: ReturnType<typeof toSavePayload>, originalSlug: string | null) {
    const {data, error} = await supabase.rpc("save_model", {
        p_model: payload as never,
        p_original_slug: originalSlug ?? undefined,
        p_dry_run: true,
    });
    if (error) throw new Error(`${error.code} ${error.message}`);
    return data as {slug: string; created: boolean; changed: boolean; dry_run: boolean};
}

const rows = modelRows as unknown as ModelWithRelations[];

// A few at a time: ~230 small RPCs, fast without hammering the project.
const queue = [...rows];
async function worker() {
    for (let row = queue.shift(); row; row = queue.shift()) {
        const model = mapModel(row, colorsByModel.get(row.id) ?? [], [], []);
        const values = modelToFormValues(model);
        const errors = validateModelForm(values, {isNew: false, currentYear});
        if (Object.keys(errors).length > 0) {
            problems.push(`${model.slug}: the form rejects the stored values — ${JSON.stringify(errors)}`);
            continue;
        }
        try {
            const result = await dryRunSave(toSavePayload(values, model.isPublished), model.slug);
            if (!result.dry_run) problems.push(`${model.slug}: NOT a dry run`);
            else if (result.changed) problems.push(`${model.slug}: an untouched save would change the model`);
            else unchanged++;
        } catch (error) {
            problems.push(`${model.slug}: ${(error as Error).message}`);
        }
    }
}
await Promise.all(Array.from({length: 6}, worker));

// Controls: the dry run does detect a real change, and leaves nothing behind.
const sample = rows[0];
const sampleModel = mapModel(sample, colorsByModel.get(sample.id) ?? [], [], []);
const edited = {...toSavePayload(modelToFormValues(sampleModel), sampleModel.isPublished), location: "ZZ verify-model-form"};
const editResult = await dryRunSave(edited, sampleModel.slug);
const createResult = await dryRunSave({...edited, slug: "zz-verify-model-form-dry-run"}, null);
const {data: after} = await supabase.from("models").select("location, updated_at").eq("id", sample.id).single();
const {count: leftover} = await supabase.from("models").select("id", {count: "exact", head: true}).eq("slug", "zz-verify-model-form-dry-run");

const controls = [
    {what: "a real edit is detected (changed: true)", ok: editResult.changed === true},
    {what: "a new model dry run reports created: true", ok: createResult.created === true},
    {what: "the dry-run edit left the model untouched", ok: after?.location === sample.location && after?.updated_at === sample.updated_at},
    {what: "the dry-run create left no model behind", ok: leftover === 0},
];

console.log(`Models checked: ${rows.length}`);
console.log(`✓ ${unchanged} round-trip unchanged (validated, dry-run save reports no change)`);
for (const p of problems) console.log(`✖ ${p}`);
for (const c of controls) console.log(`${c.ok ? "✓" : "✖"} ${c.what}`);

const failed = problems.length + controls.filter((c) => !c.ok).length;
console.log(failed ? `\n${failed} problem(s)` : `\nAll ${rows.length} models round-trip through the form unchanged`);
process.exit(failed ? 1 : 0);
