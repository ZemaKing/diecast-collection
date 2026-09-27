// `npm run verify:rls` — proves the RLS rules from ROADMAP Phase 6 against a live project,
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
    const {data: lookupDel, error: lookupErr} = await c.from("brands").delete().eq("id", f.brand.id).select();
    check(who, "DELETE brands removes nothing", !!lookupErr || lookupDel.length === 0, lookupErr?.code ?? `${lookupDel?.length} rows`);
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

const admin = await signIn(env.RLS_ADMIN_EMAIL, env.RLS_ADMIN_PASSWORD, "Admin");
const user = await signIn(env.RLS_USER_EMAIL, env.RLS_USER_PASSWORD, "Non-admin user");
const userId = (await user.auth.getUser()).data.user.id;

let fixtures;
try {
    fixtures = await createFixtures(admin);
    await checkOutsider("anon", client(), fixtures, userId);
    await checkOutsider("user", user, fixtures, userId);
    await checkAdmin(admin, fixtures);
} catch (error) {
    check("setup", "fixtures / run", false, error.message);
} finally {
    await cleanup(admin, fixtures);
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✖"} [${r.who}] ${r.what}${r.ok ? "" : `  → ${r.detail}`}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
