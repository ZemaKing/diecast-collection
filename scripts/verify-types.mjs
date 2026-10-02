// `npm run verify:types` — checks src/lib/database.types.ts against the live `diecast` schema:
// every Row column of every table/view must be selectable (PostgREST rejects unknown columns),
// and for tables that already have rows, `select *` must return exactly the typed keys.
// Signs in as the admin from .env.local (RLS_ADMIN_*), so admin-only tables are covered too.
import {readFileSync} from "node:fs";
import {createClient} from "@supabase/supabase-js";

const env = process.env;
// Normalized: a Windows checkout (core.autocrlf) has CRLF line endings.
const source = readFileSync(new URL("../src/lib/database.types.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Collect `name: { Row: { col: type ... } }` blocks.
const relations = {};
for (const match of source.matchAll(/\n\s+(\w+): \{\n\s+Row: \{\n([\s\S]*?)\n\s+\}\n/g)) {
    relations[match[1]] = [...match[2].matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
}
if (Object.keys(relations).length === 0) {
    console.error("✖ Could not parse any Row blocks from database.types.ts");
    process.exit(1);
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    db: {schema: "diecast"},
    auth: {persistSession: false},
});
const {error: signInError} = await supabase.auth.signInWithPassword({
    email: env.RLS_ADMIN_EMAIL,
    password: env.RLS_ADMIN_PASSWORD,
});
if (signInError) {
    console.error(`✖ Admin sign-in failed: ${signInError.message}`);
    process.exit(1);
}

let failures = 0;
for (const [name, columns] of Object.entries(relations)) {
    const {error} = await supabase.from(name).select(columns.join(",")).limit(1);
    if (error) {
        failures++;
        console.log(`✖ ${name}: ${error.message}`);
        continue;
    }
    const {data} = await supabase.from(name).select("*").limit(1);
    if (data?.length) {
        const live = Object.keys(data[0]).sort();
        const typed = [...columns].sort();
        const extra = live.filter((c) => !typed.includes(c));
        if (extra.length) {
            failures++;
            console.log(`✖ ${name}: live columns missing from types: ${extra.join(", ")}`);
            continue;
        }
        console.log(`✓ ${name} (${columns.length} columns, exact match on a live row)`);
    } else {
        console.log(`✓ ${name} (${columns.length} columns exist; table empty, extra-column check skipped)`);
    }
}

console.log(failures ? `\n${failures} relation(s) out of sync` : `\nAll ${Object.keys(relations).length} relations match`);
process.exit(failures ? 1 : 0);
