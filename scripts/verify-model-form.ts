// `npm run verify:model-form` — ROADMAP Phases 25–27: "editing an imported model changes nothing it
// shouldn't", proven on every model in the database, without writing anything. Since Phase 26 that
// includes the description, key features, tags and private notes; since Phase 27 the photo list.
//
// For each model this runs the admin form's exact code path — the details read mapped by
// mapModel(), modelToFormValues(), validateModelForm(), toSavePayload() — and submits the result to
// diecast.save_model() as a DRY RUN (the function executes the real statements, reports, then
// rolls itself back). Opening a model in the form and pressing Save without touching anything must:
//   - validate (every stored model is editable as-is), and
//   - report `changed: false` (every value round-trips exactly, colors in order, tags as a set,
//     photos in order with the main one first) and remove no photo files.
// Plus two controls: a real edit is detected (`changed: true`), and neither dry run left a trace.
//
// Signs in as the admin from .env.local (RLS_ADMIN_*) — the same rights the form has. Needs
// migrations 20260930150000, 20260930180000 and 20261001090000 (save_model with photos) applied.
import {createClient} from "@supabase/supabase-js";

import type {Database} from "../src/lib/database.types.ts";
import {mapModel, type ModelColorRow, type ModelTagRow, type ModelWithRelations} from "../src/services/mappers.ts";
import type {Tables} from "../src/lib/database.types.ts";
import {modelToFormValues, toSavePayload, validateModelForm, type ModelFormValues} from "../src/utils/model-form.ts";
import {toImagesPayload} from "../src/utils/model-images.ts";

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
const {data: imageRows, error: imagesError} = await supabase.from("model_images").select("*").limit(10000);
const readError = modelsError ?? colorsError ?? tagsError ?? notesError ?? imagesError;
if (readError || !modelRows || !colorRows || !tagRows || !noteRows || !imageRows) {
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
const imagesByModel = new Map<string, Tables<"model_images">[]>();
for (const row of imageRows) imagesByModel.set(row.model_id, [...(imagesByModel.get(row.model_id) ?? []), row]);
const notesByModel = new Map(noteRows.map((n) => [n.model_id, n.notes]));
const toModel = (row: ModelWithRelations) =>
    mapModel(row, colorsByModel.get(row.id) ?? [], imagesByModel.get(row.id) ?? [], tagsByModel.get(row.id) ?? []);

// What the form sends: the fields plus the photo list (existing photos only — nothing to upload).
const formPayload = (values: ModelFormValues, isPublished: boolean) =>
    ({...toSavePayload(values, isPublished), images: toImagesPayload(values.images)});

const currentYear = new Date().getFullYear();
const problems: string[] = [];
let unchanged = 0;

async function dryRunSave(payload: ReturnType<typeof formPayload>, originalSlug: string | null) {
    const {data, error} = await supabase.rpc("save_model", {
        p_model: payload as never,
        p_original_slug: originalSlug ?? undefined,
        p_dry_run: true,
    });
    if (error) throw new Error(`${error.code} ${error.message}`);
    return data as {slug: string; created: boolean; changed: boolean; removed_files: string[]; dry_run: boolean};
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
            const result = await dryRunSave(formPayload(values, model.isPublished), model.slug);
            if (!result.dry_run) problems.push(`${model.slug}: NOT a dry run`);
            else if (result.changed) problems.push(`${model.slug}: an untouched save would change the model`);
            else if (result.removed_files.length) problems.push(`${model.slug}: an untouched save would remove photo files`);
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
const edited = {...formPayload(modelToFormValues(sampleModel, notesByModel.get(sample.id) ?? null), sampleModel.isPublished), location: "ZZ verify-model-form"};
// Notes-only and tags-only edits are changes too (and roll back like the rest).
const notesResult = await dryRunSave({...edited, location: sampleModel.location, notes: "ZZ verify-model-form"}, sampleModel.slug);
const tagsResult = await dryRunSave({...edited, location: sampleModel.location, tags: [{slug: "zz-verify-model-form", name: "ZZ verify-model-form", create: true}]}, sampleModel.slug);
// A photos-only edit (removing them all) is a change too, and reports the dropped files.
const photosResult = await dryRunSave({...edited, location: sampleModel.location, images: []}, sampleModel.slug);
const sampleFiles = (imagesByModel.get(sample.id) ?? []).flatMap((i) => [i.storage_path, i.thumb_storage_path]).filter(Boolean);
const editResult = await dryRunSave(edited, sampleModel.slug);
// A new model has no photos of its own yet (the sample's photo ids would be refused, rightly, with ZK404).
const createResult = await dryRunSave({...edited, slug: "zz-verify-model-form-dry-run", images: []}, null);
const {data: after} = await supabase.from("models").select("location, updated_at").eq("id", sample.id).single();
const {count: leftover} = await supabase.from("models").select("id", {count: "exact", head: true}).eq("slug", "zz-verify-model-form-dry-run");
const {count: leftoverNotes} = await supabase.from("model_private_notes").select("model_id", {count: "exact", head: true}).eq("model_id", sample.id);
const {count: leftoverTag} = await supabase.from("tags").select("id", {count: "exact", head: true}).eq("slug", "zz-verify-model-form");
const {count: photosAfter} = await supabase.from("model_images").select("id", {count: "exact", head: true}).eq("model_id", sample.id);

const controls = [
    {what: "a real edit is detected (changed: true)", ok: editResult.changed === true},
    {what: "a notes-only edit is detected", ok: notesResult.changed === true},
    {what: "a tags-only edit (with a new tag) is detected", ok: tagsResult.changed === true},
    {what: "a photos-only edit is detected and names the files it would drop", ok: photosResult.changed === (sampleModel.images.length > 0) && photosResult.removed_files.length === sampleFiles.length},
    {what: "the dry-run photo edit left the photos in place", ok: photosAfter === sampleModel.images.length},
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
