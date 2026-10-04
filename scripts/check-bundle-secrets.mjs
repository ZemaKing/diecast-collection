// Fails if the production bundle contains anything that must never ship to browsers:
// a service_role JWT, a new-style sb_secret_ key, or the SERVICE_ROLE env var name.
// Runs automatically after `npm run build` (postbuild), including on Vercel.
//
// `node scripts/check-bundle-secrets.mjs --url https://…` (Phase 37) scans a DEPLOYED site instead:
// its index.html, the manifest and every /assets/ file reachable from them, i.e. exactly what
// visitors download. With SUPABASE_SERVICE_ROLE_KEY in the environment (e.g. via
// `node --env-file=.env.local …`) it also checks for that literal value.
import {readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative} from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TEXT = /\.(js|mjs|html|css|map|json|txt|webmanifest)$/;

function* walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) yield* walk(path);
        else if (TEXT.test(name)) yield path;
    }
}

// Every text file of a deployed site: start at "/", follow /assets/… and other same-site text refs.
async function* crawl(siteUrl) {
    const origin = new URL(siteUrl).origin;
    const queue = ["/", "/manifest.webmanifest"];
    const seen = new Set();
    while (queue.length) {
        const path = queue.shift();
        if (seen.has(path)) continue;
        seen.add(path);
        const res = await fetch(origin + path, {signal: AbortSignal.timeout(15_000)});
        if (!res.ok) throw new Error(`GET ${origin + path} → HTTP ${res.status}`);
        const content = await res.text();
        yield [path, content];
        for (const [ref] of content.matchAll(/\/?assets\/[\w.-]+\.(?:js|css|map|json)/g)) {
            queue.push(ref.startsWith("/") ? ref : `/${ref}`);
        }
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

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const findings = [];

function scan(where, content) {
    for (const [token] of content.matchAll(/eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]+/g)) {
        if (jwtRole(token) === "service_role") findings.push(`${where}: service_role JWT (${token.slice(0, 16)}…)`);
    }
    for (const [key] of content.matchAll(/sb_secret_[\w-]{6,}/g)) {
        findings.push(`${where}: Supabase secret key (${key.slice(0, 14)}…)`);
    }
    if (content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        findings.push(`${where}: references SUPABASE_SERVICE_ROLE_KEY`);
    }
    if (serviceKey && content.includes(serviceKey)) {
        findings.push(`${where}: contains the service-role key from the environment`);
    }
}

const urlFlag = process.argv.indexOf("--url");
const siteUrl = urlFlag === -1 ? null : process.argv[urlFlag + 1];
let scanned = 0;

if (siteUrl) {
    for await (const [path, content] of crawl(siteUrl)) {
        scanned++;
        scan(path, content);
    }
} else {
    for (const file of walk(DIST)) {
        scanned++;
        scan(relative(DIST, file), readFileSync(file, "utf8"));
    }
}

const target = siteUrl ?? "dist/";
if (findings.length) {
    console.error(`✖ Secrets found in ${target} — do NOT deploy:\n  ` + findings.join("\n  "));
    console.error("Remove the value from any VITE_* variable, rebuild, and rotate the key in Supabase.");
    process.exit(1);
}

console.log(`✓ No Supabase secrets in ${target} (${scanned} files scanned${serviceKey ? ", incl. the literal service-role key" : ""})`);
