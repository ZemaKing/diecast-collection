// `npm run verify:rls` — proves the RLS rules from ROADMAP Phase 6, the Phase 21 Storage bucket
// policies, the Phase 25 model-form write path (diecast.save_model), the Phase 27 photo
// management (upload → save → reorder → remove, no orphans) and the Phase 28 supporting data
// (rename / delete-while-in-use / driver merge / logo bucket) against a live project,
// using only the PUBLIC anon key plus two real logins (never the service-role key):
//
//   RLS_ADMIN_EMAIL / RLS_ADMIN_PASSWORD  — the owner (row in diecast.admin_users)
//   RLS_USER_EMAIL  / RLS_USER_PASSWORD   — any other user, NOT in admin_users
//
// Put them in .env.local (git-ignored). The admin creates throw-away fixtures (slugs start with
// "zz-rls-"), anon + the non-admin user try to read/write them, then everything is deleted again.
import {createClient} from "@supabase/supabase-js";

const env = process.env;
const url = env.VITE_SUPABASE_URL?.trim();
const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
if (!url || !anonKey) fail("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing (.env.local).");

const missing = ["RLS_ADMIN_EMAIL", "RLS_ADMIN_PASSWORD", "RLS_USER_EMAIL", "RLS_USER_PASSWORD"].filter((k) => !env[k]);
if (missing.length) fail(`Missing ${missing.join(", ")} in .env.local — see docs/SUPABASE-SETUP.md §RLS verification.`);

const client = () => createClient(url, anonKey, {db: {schema: "diecast"}, auth: {persistSession: false, autoRefreshToken: false}});
const TABLES = ["brands", "manufacturers", "categories", "colors", "drivers", "tags", "models",
    "model_colors", "model_tags", "model_images", "model_private_notes", "admin_users"];

const results = [];
const check = (who, what, ok, detail = "") => results.push({who, what, ok, detail});

function fail(message) {
    console.error(`✖ ${message}`);
    process.exit(1);
}

async function signIn(email, password, label) {
    const c = client();
    const {error} = await c.auth.signInWithPassword({email, password});
    if (error) fail(`${label} could not sign in: ${error.message}`);
    return c;
}

const suffix = Math.random().toString(36).slice(2, 8);
const slug = (name) => `zz-rls-${name}-${suffix}`;

async function createFixtures(admin) {
    const one = async (table, row) => {
        const {data, error} = await admin.from(table).insert(row).select().single();
        if (error) throw new Error(`admin insert into ${table} failed: ${error.message} (${error.code})`);
        return data;
    };
    const {data: category, error} = await admin.from("categories").select("id").eq("slug", "rally").single();
    if (error) throw new Error(`seeded category 'rally' missing: ${error.message}`);

    const brand = await one("brands", {slug: slug("brand"), name: `ZZ RLS Brand ${suffix}`});
    const manufacturer = await one("manufacturers", {slug: slug("mfr"), name: `ZZ RLS Mfr ${suffix}`});
    const color = await one("colors", {slug: slug("color"), name: `ZZ RLS Color ${suffix}`, hex: "#123ABC"});
    const tag = await one("tags", {slug: slug("tag"), name: `ZZ RLS Tag ${suffix}`});
    // Unlinked extras, so outsider INSERTs into join tables can only fail on RLS, never on a PK clash.
    const spareColor = await one("colors", {slug: slug("color2"), name: `ZZ RLS Color2 ${suffix}`, hex: "#ABC123"});
    const spareTag = await one("tags", {slug: slug("tag2"), name: `ZZ RLS Tag2 ${suffix}`});
    const base = {year: 2000, brand_id: brand.id, manufacturer_id: manufacturer.id, category_id: category.id, livery_hex: ["#123ABC"]};
    const published = await one("models", {...base, slug: slug("published"), name: "ZZ RLS Published"});
    const draft = await one("models", {...base, slug: slug("draft"), name: "ZZ RLS Draft", is_published: false});
    for (const m of [published, draft]) {
        await one("model_images", {model_id: m.id, position: 0, is_primary: true, external_url: "https://example.com/x.png"});
        await one("model_colors", {model_id: m.id, color_id: color.id, position: 0});
        await one("model_tags", {model_id: m.id, tag_id: tag.id});
        await one("model_private_notes", {model_id: m.id, notes: "secret"});
    }
    return {brand, manufacturer, color, tag, spareColor, spareTag, category, published, draft};
}

async function cleanup(admin, f) {
    if (!f) return;
    // Models created through save_model (Phase 25 checks) — their colors cascade.
    await admin.from("models").delete().like("slug", `zz-rls-form%-${suffix}`);
    await admin.from("tags").delete().like("slug", `zz-rls-form%-${suffix}`);
    // Phase 28 driver-merge fixtures point at the published model — unhook them first.
    await admin.from("models").update({driver_id: null}).in("id", [f.published?.id, f.draft?.id].filter(Boolean));
    await admin.from("drivers").delete().like("slug", `zz-rls-drv%-${suffix}`);
    await admin.from("models").delete().in("id", [f.published?.id, f.draft?.id].filter(Boolean));
    await admin.from("tags").delete().in("id", [f.tag?.id, f.spareTag?.id].filter(Boolean));
    await admin.from("colors").delete().in("id", [f.color?.id, f.spareColor?.id].filter(Boolean));
    await admin.from("brands").delete().eq("id", f.brand?.id ?? "00000000-0000-0000-0000-000000000000");
    await admin.from("manufacturers").delete().eq("id", f.manufacturer?.id ?? "00000000-0000-0000-0000-000000000000");
    const {count} = await admin.from("models").select("id", {count: "exact", head: true}).like("slug", "zz-rls-%");
    if (count) console.warn(`⚠ ${count} zz-rls-* models left behind — delete them in the dashboard.`);
}

// A row that would be valid if the caller were allowed to write it — so a rejection proves RLS/grants,
// not a constraint.
function validRow(table, f, uid) {
    const id = {model_id: f.published.id};
    switch (table) {
        case "brands": case "manufacturers": case "drivers": case "tags": case "categories":
            return {slug: slug(`x-${table}`), name: `ZZ X ${table} ${suffix}`};
        case "colors": return {slug: slug("x-color"), name: `ZZ X color ${suffix}`};
        case "models": return {slug: slug("x-model"), name: "X", year: 2000, brand_id: f.brand.id, manufacturer_id: f.manufacturer.id, category_id: f.category.id};
        case "model_colors": return {...id, color_id: f.spareColor.id, position: 5};
        case "model_tags": return {...id, tag_id: f.spareTag.id};
        case "model_images": return {...id, position: 5, external_url: "https://example.com/y.png"};
        case "model_private_notes": return {model_id: f.published.id, notes: "hack"};
        case "admin_users": return {user_id: uid};
    }
}

const denied = (error) => error && (error.code === "42501" || /permission denied|row-level security/i.test(error.message));

async function checkOutsider(who, c, f, uid) {
    const {data: isAdmin} = await c.rpc("is_admin");
    check(who, "is_admin() is false", isAdmin === false, String(isAdmin));

    const count = async (table, column, value) => {
        const {data, error} = await c.from(table).select("*").eq(column, value);
        return error ? `error ${error.code}` : data.length;
    };
    check(who, "sees the published model", (await count("models", "id", f.published.id)) === 1);
    check(who, "does NOT see the draft model", (await count("models", "id", f.draft.id)) === 0);
    check(who, "does NOT see the draft via model_summaries", (await count("model_summaries", "id", f.draft.id)) === 0);
    check(who, "sees the published model via model_summaries", (await count("model_summaries", "id", f.published.id)) === 1);
    for (const t of ["model_images", "model_colors", "model_tags"]) {
        check(who, `sees ${t} of the published model`, (await count(t, "model_id", f.published.id)) === 1);
        check(who, `does NOT see ${t} of the draft`, (await count(t, "model_id", f.draft.id)) === 0);
    }
    for (const t of ["model_private_notes", "admin_users"]) {
        const {data, error} = await c.from(t).select("*");
        check(who, `cannot read ${t}`, !!error || data.length === 0, error ? error.code : `${data.length} rows`);
    }

    for (const t of TABLES) {
        const {error} = await c.from(t).insert(validRow(t, f, uid));
        check(who, `INSERT into ${t} denied`, denied(error), error ? error.code : "INSERT SUCCEEDED");
    }

    const {data: updated, error: updError} = await c.from("models").update({name: "HACKED"}).eq("id", f.published.id).select();
    check(who, "UPDATE models changes nothing", !!updError || updated.length === 0, updError?.code ?? `${updated?.length} rows`);
    const {data: deleted, error: delError} = await c.from("models").delete().eq("id", f.published.id).select();
    check(who, "DELETE models removes nothing", !!delError || deleted.length === 0, delError?.code ?? `${deleted?.length} rows`);
    // Photos (Phase 27): outsiders can't reorder, re-point or delete a model's photo rows.
    const {data: imgUpd, error: imgUpdErr} = await c.from("model_images").update({external_url: "https://example.com/hacked.png"}).eq("model_id", f.published.id).select();
    check(who, "UPDATE model_images changes nothing", !!imgUpdErr || imgUpd.length === 0, imgUpdErr?.code ?? `${imgUpd?.length} rows`);
    const {data: imgDel, error: imgDelErr} = await c.from("model_images").delete().eq("model_id", f.published.id).select();
    check(who, "DELETE model_images removes nothing", !!imgDelErr || imgDel.length === 0, imgDelErr?.code ?? `${imgDel?.length} rows`);
    const {data: lookupDel, error: lookupErr} = await c.from("brands").delete().eq("id", f.brand.id).select();
    check(who, "DELETE brands removes nothing", !!lookupErr || lookupDel.length === 0, lookupErr?.code ?? `${lookupDel?.length} rows`);
    // Supporting data (Phase 28): outsiders can't rename a lookup or merge drivers.
    const {data: lookupUpd, error: lookupUpdErr} = await c.from("manufacturers").update({name: "HACKED"}).eq("id", f.manufacturer.id).select();
    check(who, "UPDATE (rename) manufacturers changes nothing", !!lookupUpdErr || lookupUpd.length === 0, lookupUpdErr?.code ?? `${lookupUpd?.length} rows`);
    const {error: mergeErr} = await c.rpc("merge_drivers", {p_from_slug: "x", p_into_slug: "y"});
    check(who, "merge_drivers denied", denied(mergeErr), mergeErr ? `${mergeErr.code} ${mergeErr.message}` : "MERGE RAN");

    // The model form's write path (Phase 25): save_model() runs with the caller's rights.
    const {error: createErr} = await c.rpc("save_model", {p_model: formPayload(f, slug(`form-${who}`))});
    check(who, "save_model create denied", denied(createErr), createErr ? createErr.code : "CREATE SUCCEEDED");
    const {error: editErr} = await c.rpc("save_model", {
        p_model: {...formPayload(f, f.published.slug), name: "HACKED", is_published: true},
        p_original_slug: f.published.slug,
    });
    check(who, "save_model update denied", denied(editErr), editErr ? editErr.code : "UPDATE SUCCEEDED");
    const {count: created} = await c.from("models").select("id", {count: "exact", head: true}).eq("slug", slug(`form-${who}`));
    check(who, "save_model left no model behind", !created, `${created} rows`);
}

// A valid save_model payload built on the fixtures (a non-racing Rally draft).
function formPayload(f, modelSlug) {
    return {
        slug: modelSlug, name: "ZZ RLS Form", year: 2001, scale: "1:43",
        brand: {slug: f.brand.slug}, manufacturer: {slug: f.manufacturer.slug}, category_slug: "rally",
        color_slugs: [f.color.slug], livery_hex: ["#123ABC"], is_racing: false, driver: null, is_published: false,
    };
}

// Admin side of the model form (Phase 25): create a draft, anon can't see it, a duplicate slug is
// refused with a clear message, edits apply, an unchanged save writes nothing, delete cascades.
async function checkModelForm(admin, anon, user, f) {
    const formSlug = slug("form");
    const {data: created, error: createErr} = await admin.rpc("save_model", {p_model: formPayload(f, formSlug)});
    check("admin", "save_model creates a draft", !createErr && created?.created === true, createErr?.message ?? JSON.stringify(created));
    if (createErr) return;

    const {data: anonSees} = await anon.from("model_summaries").select("id").eq("slug", formSlug);
    check("anon", "does NOT see a draft saved with the form", anonSees?.length === 0, `${anonSees?.length} rows`);
    // Separate reads: embedding model_colors from models is ambiguous (the view shares its FK).
    const {data: formModel} = await admin.from("models").select("id").eq("slug", formSlug).single();
    const {count: colorCount} = await admin.from("model_colors").select("model_id", {count: "exact", head: true}).eq("model_id", formModel?.id ?? "");
    check("admin", "save_model writes the colors in the same call", colorCount === 1, `${colorCount} colors`);

    const {error: dupErr} = await admin.rpc("save_model", {p_model: formPayload(f, formSlug)});
    check("admin", "duplicate slug rejected with a clear message", dupErr?.code === "ZK409" && /already exists/.test(dupErr.message), dupErr ? `${dupErr.code} ${dupErr.message}` : "DUPLICATE SAVED");

    const edited = {...formPayload(f, formSlug), name: "ZZ RLS Form Edited", color_slugs: [f.spareColor.slug, f.color.slug]};
    const {data: edit, error: editErr} = await admin.rpc("save_model", {p_model: edited, p_original_slug: formSlug});
    check("admin", "save_model edits", !editErr && edit?.changed === true, editErr?.message ?? JSON.stringify(edit));
    const {data: again} = await admin.rpc("save_model", {p_model: edited, p_original_slug: formSlug});
    check("admin", "an unchanged save writes nothing", again?.changed === false, JSON.stringify(again));
    const {data: renamed} = await admin.rpc("save_model", {p_model: {...edited, slug: "zz-rls-renamed"}, p_original_slug: formSlug});
    check("admin", "the slug is stable after creation", renamed?.slug === formSlug, JSON.stringify(renamed));

    // Phase 26: the form saves private notes + tags in the same call. Published WITH notes, the model
    // is public — its notes must still never reach anyone but the admin.
    const tagSlug = slug("formtag");
    const {data: rich, error: richErr} = await admin.rpc("save_model", {
        p_model: {...edited, is_published: true, description: "**zz** rls", notes: "zz-rls private note",
            tags: [{slug: tagSlug, name: `ZZ RLS FormTag ${suffix}`, create: true}]},
        p_original_slug: formSlug,
    });
    check("admin", "save_model saves description, tags and private notes", !richErr && rich?.changed === true, richErr?.message ?? JSON.stringify(rich));
    const {data: ownNotes} = await admin.from("model_private_notes").select("notes").eq("model_id", formModel?.id ?? "");
    check("admin", "reads the note it saved", ownNotes?.[0]?.notes === "zz-rls private note", JSON.stringify(ownNotes));
    const {count: tagLinks} = await admin.from("model_tags").select("model_id", {count: "exact", head: true}).eq("model_id", formModel?.id ?? "");
    check("admin", "the new tag is created and linked", tagLinks === 1, `${tagLinks} tag links`);
    for (const [who, c] of [["anon", anon], ["user", user]]) {
        const {data: summary} = await c.from("model_summaries").select("*").eq("slug", formSlug);
        check(who, "sees the published form model", summary?.length === 1, `${summary?.length} rows`);
        const leaked = JSON.stringify(summary ?? []).includes("zz-rls private note");
        check(who, "its private note is in no public column", !leaked, leaked ? "NOTE LEAKED" : "");
        const {data: notes, error: notesErr} = await c.from("model_private_notes").select("*").eq("model_id", formModel?.id ?? "");
        check(who, "cannot read the form model's private notes", !!notesErr || notes.length === 0, notesErr ? notesErr.code : `${notes.length} rows`);
    }
    const {data: cleared} = await admin.rpc("save_model", {p_model: {...edited, is_published: true, notes: ""}, p_original_slug: formSlug});
    const {count: notesLeft} = await admin.from("model_private_notes").select("model_id", {count: "exact", head: true}).eq("model_id", formModel?.id ?? "");
    check("admin", "emptying the notes deletes the row", cleared?.changed === true && notesLeft === 0, `${notesLeft} rows`);

    const {data: gone, error: delErr} = await admin.from("models").delete().eq("slug", formSlug).select("id");
    check("admin", "DELETE models works", !delErr && gone?.length === 1, delErr?.message ?? `${gone?.length} rows`);
    const {count: leftColors} = await admin.from("model_colors").select("model_id", {count: "exact", head: true}).eq("model_id", formModel?.id ?? "");
    check("admin", "deleting a model removes its colors (cascade)", leftColors === 0, `${leftColors} left`);
}

// Phase 28 — supporting data, as the admin: a lookup in use can't be deleted (FK RESTRICT), a
// rename shows on its models for everyone, and merge_drivers moves the models then deletes the
// duplicate in one transaction (dry run leaves everything as it was).
async function checkSupportingData(admin, anon, f) {
    const {error: inUse} = await admin.from("manufacturers").delete().eq("id", f.manufacturer.id).select();
    check("admin", "a manufacturer in use can't be deleted (FK RESTRICT)", inUse?.code === "23503", inUse ? inUse.code : "DELETED");

    const renamed = `ZZ RLS Mfr renamed ${suffix}`;
    const {error: renameErr} = await admin.from("manufacturers").update({name: renamed}).eq("id", f.manufacturer.id);
    const {data: summary} = await anon.from("model_summaries").select("manufacturer_name").eq("id", f.published.id).single();
    check("anon", "a renamed manufacturer shows on its models", !renameErr && summary?.manufacturer_name === renamed,
        renameErr?.message ?? summary?.manufacturer_name);

    const driver = async (key, extra = {}) => {
        const {data, error} = await admin.from("drivers").insert({slug: slug(`drv-${key}`), name: `ZZ RLS Driver ${key} ${suffix}`, ...extra}).select().single();
        if (error) throw new Error(`driver fixture failed: ${error.message}`);
        return data;
    };
    const dupe = await driver("a", {country_code: "FI"});
    const keep = await driver("b");
    await admin.from("models").update({driver_id: dupe.id}).eq("id", f.published.id);

    const merge = (from, into, dryRun = false) => admin.rpc("merge_drivers", {p_from_slug: from, p_into_slug: into, p_dry_run: dryRun});
    const {error: self} = await merge(dupe.slug, dupe.slug);
    check("admin", "merging a driver into itself is refused", self?.code === "ZK422", self?.code ?? "ACCEPTED");
    const {error: unknown} = await merge(slug("drv-nobody"), keep.slug);
    check("admin", "merging an unknown driver is refused", unknown?.code === "ZK404", unknown?.code ?? "ACCEPTED");

    const {data: dry, error: dryErr} = await merge(dupe.slug, keep.slug, true);
    const {count: stillThere} = await admin.from("drivers").select("id", {count: "exact", head: true}).eq("id", dupe.id);
    check("admin", "a dry-run merge reports and changes nothing", !dryErr && dry?.moved === 1 && dry?.dry_run === true && stillThere === 1,
        dryErr?.message ?? JSON.stringify(dry));

    const {data: merged, error: mergeErr} = await merge(dupe.slug, keep.slug);
    const {data: model} = await admin.from("models").select("driver_id").eq("id", f.published.id).single();
    const {count: gone} = await admin.from("drivers").select("id", {count: "exact", head: true}).eq("id", dupe.id);
    const {data: kept} = await admin.from("drivers").select("country_code").eq("id", keep.id).single();
    check("admin", "merge_drivers moves the models and deletes the duplicate",
        !mergeErr && merged?.moved === 1 && model?.driver_id === keep.id && gone === 0,
        mergeErr?.message ?? JSON.stringify({merged, model, gone}));
    check("admin", "merge keeps the duplicate's flag when the kept driver had none", kept?.country_code === "FI", kept?.country_code);
}

async function checkAdmin(admin, f) {
    const {data: isAdmin} = await admin.rpc("is_admin");
    check("admin", "is_admin() is true", isAdmin === true, String(isAdmin));
    const {data: draft} = await admin.from("models").select("id").eq("id", f.draft.id);
    check("admin", "sees the draft model", draft?.length === 1);
    const {data: notes} = await admin.from("model_private_notes").select("*").in("model_id", [f.published.id, f.draft.id]);
    check("admin", "reads private notes", notes?.length === 2);
    const {data: allow} = await admin.from("admin_users").select("user_id");
    check("admin", "reads admin_users", (allow?.length ?? 0) >= 1);
    const {data: upd, error} = await admin.from("models").update({name: "ZZ RLS Renamed"}).eq("id", f.draft.id).select();
    check("admin", "UPDATE models works", !error && upd?.length === 1, error?.message ?? "");
    const {data: pub} = await admin.from("models").select("name").eq("id", f.published.id).single();
    check("admin", "published model untouched by outsiders", pub?.name === "ZZ RLS Published", pub?.name);
    const {error: insErr} = await admin.from("admin_users").insert({user_id: (await admin.auth.getUser()).data.user.id});
    check("admin", "cannot write admin_users via API (SQL editor only)", denied(insErr), insErr?.code ?? "INSERT SUCCEEDED");
}

// Storage bucket `model-images` (Phase 21): public read via public URLs, admin-only writes, and
// nobody but the admin can LIST it. The throw-away object lives under zz-rls/.
const BUCKET = "model-images";
const objectPath = `zz-rls/${suffix}.webp`;
const webp = () => new Blob([new Uint8Array([82, 73, 70, 70])], {type: "image/webp"});

async function checkStorage(anon, user, admin) {
    for (const [who, c] of [["anon", anon], ["user", user]]) {
        const {error} = await c.storage.from(BUCKET).upload(`zz-rls/${who}-${suffix}.webp`, webp(), {contentType: "image/webp"});
        check(who, "storage upload denied", !!error, error?.message ?? "UPLOAD SUCCEEDED");
    }
    const {error: upErr} = await admin.storage.from(BUCKET).upload(objectPath, webp(), {contentType: "image/webp"});
    check("admin", "storage upload works", !upErr, upErr?.message ?? "");
    const {error: typeErr} = await admin.storage.from(BUCKET).upload(`zz-rls/${suffix}.txt`, new Blob(["x"]), {contentType: "text/plain"});
    check("admin", "storage rejects non-image types", !!typeErr, typeErr?.message ?? "UPLOAD SUCCEEDED");

    const publicUrl = admin.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
    const response = await fetch(publicUrl);
    check("anon", "reads the object via its public URL", response.status === 200, `HTTP ${response.status}`);

    for (const [who, c] of [["anon", anon], ["user", user]]) {
        const {data} = await c.storage.from(BUCKET).list("zz-rls");
        check(who, "cannot list the bucket", !data?.some((o) => objectPath.endsWith(o.name)), `${data?.length} listed`);
        const {data: removed} = await c.storage.from(BUCKET).remove([objectPath]);
        check(who, "storage delete removes nothing", !removed?.length, `${removed?.length} removed`);
        const {error: overwrite} = await c.storage.from(BUCKET).upload(objectPath, webp(), {contentType: "image/webp", upsert: true});
        check(who, "storage overwrite denied", !!overwrite, overwrite?.message ?? "OVERWRITE SUCCEEDED");
    }
    const {data: listed} = await admin.storage.from(BUCKET).list("zz-rls");
    check("admin", "lists the bucket", !!listed?.some((o) => objectPath.endsWith(o.name)));
}

// Phase 27: the model form's photo cycle, as the admin — upload two photos, save them with the
// model, reorder (the main photo follows position 0), refuse foreign paths and foreign photo ids,
// then remove them all: save_model reports the files, deleting them leaves nothing public.
async function checkModelImages(admin, f) {
    const photoSlug = slug("form-photos");
    const {error: createErr} = await admin.rpc("save_model", {p_model: formPayload(f, photoSlug)});
    if (createErr) throw new Error(`photo model create failed: ${createErr.message}`);
    const paths = ["aa", "bb"].map((key) => ({
        storage_path: `models/${photoSlug}/${key}${suffix}-full.webp`,
        thumb_storage_path: `models/${photoSlug}/${key}${suffix}-thumb.webp`,
        width: 1600, height: 900,
    }));
    for (const p of paths) {
        for (const path of [p.storage_path, p.thumb_storage_path]) {
            const {error} = await admin.storage.from(BUCKET).upload(path, webp(), {contentType: "image/webp", cacheControl: "604800", upsert: false});
            if (error) throw new Error(`photo upload failed: ${error.message}`);
        }
    }
    const {data: photoModel} = await admin.from("models").select("id").eq("slug", photoSlug).single();
    const save = (images) => admin.rpc("save_model", {p_model: {...formPayload(f, photoSlug), images}, p_original_slug: photoSlug});
    const rows = async () => (await admin.from("model_images").select("id, position, is_primary, storage_path")
        .eq("model_id", photoModel.id).order("position")).data ?? [];

    const {data: added, error: addErr} = await save(paths);
    let stored = await rows();
    check("admin", "save_model adds uploaded photos in order, first = primary",
        !addErr && added?.changed === true && stored.length === 2 && stored[0].storage_path === paths[0].storage_path
            && stored[0].is_primary && !stored[1].is_primary && stored[1].position === 1,
        addErr?.message ?? JSON.stringify(stored));

    const {data: same} = await save(stored.map((r) => ({id: r.id})));
    check("admin", "an unchanged photo list writes nothing", same?.changed === false && same?.removed_files?.length === 0, JSON.stringify(same));

    const {data: swapped} = await save([{id: stored[1].id}, {id: stored[0].id}]);
    const reordered = await rows();
    check("admin", "reordering moves the primary with position 0",
        swapped?.changed === true && reordered[0].id === stored[1].id && reordered[0].is_primary && !reordered[1].is_primary,
        JSON.stringify(reordered));
    stored = reordered;

    const {error: foreignPath} = await save([...stored.map((r) => ({id: r.id})), {...paths[0], storage_path: `models/someone-else/x${suffix}-full.webp`}]);
    check("admin", "a photo outside the model's folder is refused", foreignPath?.code === "ZK422", foreignPath?.code ?? "ACCEPTED");
    const {data: otherImage} = await admin.from("model_images").select("id").eq("model_id", f.published.id).single();
    const {error: foreignId} = await save([{id: otherImage.id}]);
    check("admin", "another model's photo can't be taken over", foreignId?.code === "ZK404", foreignId?.code ?? "ACCEPTED");
    const {error: tooMany} = await save(Array.from({length: 11}, (_, i) => ({...paths[0], storage_path: `models/${photoSlug}/n${i}-full.webp`})));
    check("admin", "more than 10 photos are refused", tooMany?.code === "ZK422", tooMany?.code ?? "ACCEPTED");

    const {data: cleared} = await save([]);
    const files = paths.flatMap((p) => [p.storage_path, p.thumb_storage_path]);
    const reported = [...(cleared?.removed_files ?? [])].sort();
    check("admin", "removing the photos deletes the rows and reports every file",
        (await rows()).length === 0 && JSON.stringify(reported) === JSON.stringify([...files].sort()), JSON.stringify(cleared));
    const {error: removeErr} = await admin.storage.from(BUCKET).remove(reported);
    check("admin", "the reported files can be deleted", !removeErr, removeErr?.message ?? "");
    const status = (await fetch(admin.storage.from(BUCKET).getPublicUrl(files[0]).data.publicUrl)).status;
    check("anon", "a removed photo is gone from Storage", status !== 200, `HTTP ${status}`);
    const {data: left} = await admin.storage.from(BUCKET).list(`models/${photoSlug}`);
    check("admin", "no orphaned files are left", (left ?? []).length === 0, `${left?.length} left`);
}

// Phase 28: the lookup-logos bucket — same rules as model-images, SVG allowed.
const LOGO_BUCKET = "lookup-logos";
const logoPath = `zz-rls/${suffix}.svg`;
const svg = () => new Blob(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'], {type: "image/svg+xml"});

async function checkLogoStorage(anon, user, admin) {
    for (const [who, c] of [["anon", anon], ["user", user]]) {
        const {error} = await c.storage.from(LOGO_BUCKET).upload(`zz-rls/${who}-${suffix}.svg`, svg(), {contentType: "image/svg+xml"});
        check(who, "logo upload denied", !!error, error?.message ?? "UPLOAD SUCCEEDED");
    }
    const {error: upErr} = await admin.storage.from(LOGO_BUCKET).upload(logoPath, svg(), {contentType: "image/svg+xml", cacheControl: "604800"});
    check("admin", "logo upload (SVG) works", !upErr, upErr?.message ?? "");
    const {error: typeErr} = await admin.storage.from(LOGO_BUCKET).upload(`zz-rls/${suffix}.txt`, new Blob(["x"]), {contentType: "text/plain"});
    check("admin", "logo bucket rejects non-image types", !!typeErr, typeErr?.message ?? "UPLOAD SUCCEEDED");
    const status = (await fetch(admin.storage.from(LOGO_BUCKET).getPublicUrl(logoPath).data.publicUrl)).status;
    check("anon", "reads an uploaded logo via its public URL", status === 200, `HTTP ${status}`);
    for (const [who, c] of [["anon", anon], ["user", user]]) {
        const {data: removed} = await c.storage.from(LOGO_BUCKET).remove([logoPath]);
        check(who, "logo delete removes nothing", !removed?.length, `${removed?.length} removed`);
    }
    const {error: removeErr} = await admin.storage.from(LOGO_BUCKET).remove([logoPath]);
    check("admin", "logo delete works", !removeErr, removeErr?.message ?? "");
}

async function cleanupStorage(admin) {
    const {data: logos} = await admin.storage.from(LOGO_BUCKET).list("zz-rls");
    if (logos?.length) await admin.storage.from(LOGO_BUCKET).remove(logos.map((o) => `zz-rls/${o.name}`));
    const {data} = await admin.storage.from(BUCKET).list("zz-rls");
    if (data?.length) await admin.storage.from(BUCKET).remove(data.map((o) => `zz-rls/${o.name}`));
    const {data: left} = await admin.storage.from(BUCKET).list("zz-rls");
    if (left?.length) console.warn(`⚠ ${left.length} object(s) left under ${BUCKET}/zz-rls/ — delete them in the dashboard.`);
    const photoFolder = `models/${slug("form-photos")}`;
    const {data: photos} = await admin.storage.from(BUCKET).list(photoFolder);
    if (photos?.length) await admin.storage.from(BUCKET).remove(photos.map((o) => `${photoFolder}/${o.name}`));
}

const admin = await signIn(env.RLS_ADMIN_EMAIL, env.RLS_ADMIN_PASSWORD, "Admin");
const user = await signIn(env.RLS_USER_EMAIL, env.RLS_USER_PASSWORD, "Non-admin user");
const userId = (await user.auth.getUser()).data.user.id;

let fixtures;
try {
    fixtures = await createFixtures(admin);
    await checkOutsider("anon", client(), fixtures, userId);
    await checkOutsider("user", user, fixtures, userId);
    await checkAdmin(admin, fixtures);
    await checkModelForm(admin, client(), user, fixtures);
    await checkSupportingData(admin, client(), fixtures);
} catch (error) {
    check("setup", "fixtures / run", false, error.message);
} finally {
    await cleanup(admin, fixtures);
}
// Storage + the Phase 27 photo cycle, on fresh fixtures (they need the bucket from migration
// 20260930120000; a failure here doesn't hide the table checks above).
try {
    fixtures = await createFixtures(admin);
    await checkStorage(client(), user, admin);
    await checkModelImages(admin, fixtures);
} catch (error) {
    check("setup", "storage / photo checks", false, error.message);
}
// The Phase 28 logo bucket (migration 20261002090000) — separate, so a missing bucket doesn't hide the rest.
try {
    await checkLogoStorage(client(), user, admin);
} catch (error) {
    check("setup", "logo storage checks", false, error.message);
} finally {
    await cleanupStorage(admin);
    await cleanup(admin, fixtures);
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✖"} [${r.who}] ${r.what}${r.ok ? "" : `  → ${r.detail}`}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
