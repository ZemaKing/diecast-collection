// DEV ONLY (imported behind import.meta.env.DEV in main.tsx, so it never ships).
// Logs whether Supabase is configured and reachable, without affecting the UI.
import {EnvError} from "./env.ts";
import {checkSupabaseHealth} from "./supabase-health.ts";

export async function reportSupabaseConnectivity(): Promise<void> {
    try {
        const {supabaseEnv} = await import("./supabase.ts");
        const result = await checkSupabaseHealth(supabaseEnv);
        if (result.ok) {
            console.info(`[supabase] connected to ${supabaseEnv.url} (${result.latencyMs} ms)`);
        } else {
            console.error(`[supabase] ${supabaseEnv.url} is not reachable (${result.error.kind}):`, result.error);
        }
    } catch (error) {
        // Not fatal yet: the UI still reads JSON until ROADMAP Phase 10.
        if (error instanceof EnvError) console.warn(`[supabase] ${error.message}`);
        else console.error("[supabase] connectivity check failed:", error);
    }
}
