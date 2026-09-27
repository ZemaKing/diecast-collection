// Fails if the production bundle contains anything that must never ship to browsers:
// a service_role JWT, a new-style sb_secret_ key, or the SERVICE_ROLE env var name.
// Runs automatically after `npm run build` (postbuild), including on Vercel.
import {readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative} from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TEXT = /\.(js|mjs|html|css|map|json|txt)$/;

function* walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) yield* walk(path);
        else if (TEXT.test(name)) yield path;
    }
}

function jwtRole(token) {
    try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(Buffer.from(payload, "base64").toString("utf8")).role ?? null;
    } catch {
        return null;
    }
}

const findings = [];
let scanned = 0;

for (const file of walk(DIST)) {
    scanned++;
    const content = readFileSync(file, "utf8");
    const where = relative(DIST, file);

    for (const [token] of content.matchAll(/eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]+/g)) {
        if (jwtRole(token) === "service_role") findings.push(`${where}: service_role JWT (${token.slice(0, 16)}…)`);
    }
    for (const [key] of content.matchAll(/sb_secret_[\w-]{6,}/g)) {
        findings.push(`${where}: Supabase secret key (${key.slice(0, 14)}…)`);
    }
    if (content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        findings.push(`${where}: references SUPABASE_SERVICE_ROLE_KEY`);
    }
}

if (findings.length) {
    console.error("✖ Secrets found in the production bundle — do NOT deploy:\n  " + findings.join("\n  "));
    console.error("Remove the value from any VITE_* variable, rebuild, and rotate the key in Supabase.");
    process.exit(1);
}

console.log(`✓ No Supabase secrets in dist/ (${scanned} files scanned)`);
