// `npm run supabase:check` — verifies .env.local points at a reachable Supabase project with a
// public (anon/publishable) key. Same probe as the in-app dev check, runnable without a browser.
const url = process.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!url || !key) {
    console.error("✖ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing. Copy .env.example to .env.local and fill them in.");
    process.exit(1);
}

if (key.startsWith("sb_secret_") || /"role"\s*:\s*"service_role"/.test(safeDecode(key))) {
    console.error("✖ VITE_SUPABASE_ANON_KEY is a SECRET key. Use the anon/publishable key; rotate the secret if it leaked.");
    process.exit(1);
}

const started = Date.now();
try {
    const res = await fetch(`${url}/auth/v1/health`, {headers: {apikey: key}, signal: AbortSignal.timeout(8000)});
    if (!res.ok) {
        console.error(`✖ ${url} answered HTTP ${res.status}${res.status === 401 ? " — the key was rejected" : ""}`);
        process.exit(1);
    }
    const body = await res.json().catch(() => ({}));
    console.log(`✓ Connected to ${url} in ${Date.now() - started} ms${body.version ? ` (auth ${body.version})` : ""}`);
} catch (error) {
    console.error(`✖ Could not reach ${url}: ${error.cause?.code ?? error.message}`);
    process.exit(1);
}

function safeDecode(token) {
    try {
        return Buffer.from(token.split(".")[1] ?? "", "base64").toString("utf8");
    } catch {
        return "";
    }
}
