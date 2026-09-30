// `npm run verify:model-form` — ROADMAP Phases 25–26: "editing an imported model changes nothing it
// shouldn't", proven on every model in the database, without writing anything. Since Phase 26 that
// includes the description, key features, tags and private notes.
//
// For each model this runs the admin form's exact code path — the details read mapped by
// mapModel(), modelToFormValues(), validateModelForm(), toSavePayload() — and submits the result to
// diecast.save_model() as a DRY RUN (the function executes the real statements, reports, then
// rolls itself back). Opening a model in the form and pressing Save without touching anything must:
//   - validate (every stored model is editable as-is), and
//   - report `changed: false` (every value round-trips exactly, colors in order, tags as a set).
// Plus two controls: a real edit is detected (`changed: true`), and neither dry run left a trace.
//
// Signs in as the admin from .env.local (RLS_ADMIN_*) — the same rights the form has. Needs
// migrations 20260930150000 and 20260930180000 (save_model with rich fields) applied.
import {createClient} from "@supabase/supabase-js";

import type {Database} from "../src/lib/database.types.ts";
import {mapModel, type ModelColorRow, type ModelTagRow, type ModelWithRelations} from "../src/services/mappers.ts";
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
const {data: tagRows, error: tagsError} = await supabase.from("model_tags").select("model_id, tag:tags(*)").limit(10000);
const {data: noteRows, error: notesError} = await supabase.from("model_private_notes").select("model_id, notes").limit(10000);
const readError = modelsError ?? colorsError ?? tagsError ?? notesError;
if (readError || !modelRows || !colorRows || !tagRows || !noteRows) {
    console.error(`✖ Read failed: ${readError?.message}`);
    process.exit(1);
}

const colorsByModel = new Map<string, ModelColorRow[]>();
for (const row of colorRows as unknown as (ModelColorRow & {model_id: string})[]) {
    colorsByModel.set(row.model_id, [...(colorsByModel.get(row.model_id) ?? []), row]);
}
const tagsByModel = new Map<string, ModelTagRow[]>();
for (const row of tagRows as unknown as (ModelTagRow & {model_id: string})[]) {
    tagsByModel.set(row.model_id, [...(tagsByModel.get(row.model_id) ?? []), row]);
}
const notesByModel = new Map(noteRows.map((n) => [n.model_id, n.notes]));
const toModel = (row: ModelWithRelations) => mapModel(row, colorsByModel.get(row.id) ?? [], [], tagsByModel.get(row.id) ?? []);

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
        const model = toModel(row);
        const values = modelToFormValues(model, notesByModel.get(row.id) ?? null);
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
const sampleModel = toModel(sample);
const edited = {...toSavePayload(modelToFormValues(sampleModel, notesByModel.get(sample.id) ?? null), sampleModel.isPublished), location: "ZZ verify-model-form"};
// Notes-only and tags-only edits are changes too (and roll back like the rest).
const notesResult = await dryRunSave({...edited, location: sampleModel.location, notes: "ZZ verify-model-form"}, sampleModel.slug);
const tagsResult = await dryRunSave({...edited, location: sampleModel.location, tags: [{slug: "zz-verify-model-form", name: "ZZ verify-model-form", create: true}]}, sampleModel.slug);
const editResult = await dryRunSave(edited, sampleModel.slug);
const createResult = await dryRunSave({...edited, slug: "zz-verify-model-form-dry-run"}, null);
const {data: after} = await supabase.from("models").select("location, updated_at").eq("id", sample.id).single();
const {count: leftover} = await supabase.from("models").select("id", {count: "exact", head: true}).eq("slug", "zz-verify-model-form-dry-run");
const {count: leftoverNotes} = await supabase.from("model_private_notes").select("model_id", {count: "exact", head: true}).eq("model_id", sample.id);
const {count: leftoverTag} = await supabase.from("tags").select("id", {count: "exact", head: true}).eq("slug", "zz-verify-model-form");

const controls = [
    {what: "a real edit is detected (changed: true)", ok: editResult.changed === true},
    {what: "a notes-only edit is detected", ok: notesResult.changed === true},
    {what: "a tags-only edit (with a new tag) is detected", ok: tagsResult.changed === true},
    {what: "a new model dry run reports created: true", ok: createResult.created === true},
    {what: "the dry-run edit left the model untouched", ok: after?.location === sample.location && after?.updated_at === sample.updated_at},
    {what: "the dry-run create left no model behind", ok: leftover === 0},
    {what: "the dry runs left no notes or tag behind", ok: leftoverNotes === (notesByModel.has(sample.id) ? 1 : 0) && leftoverTag === 0},
];

console.log(`Models checked: ${rows.length}`);
console.log(`✓ ${unchanged} round-trip unchanged (validated, dry-run save reports no change)`);
for (const p of problems) console.log(`✖ ${p}`);
for (const c of controls) console.log(`${c.ok ? "✓" : "✖"} ${c.what}`);

const failed = problems.length + controls.filter((c) => !c.ok).length;
console.log(failed ? `\n${failed} problem(s)` : `\nAll ${rows.length} models round-trip through the form unchanged`);
process.exit(failed ? 1 : 0);
