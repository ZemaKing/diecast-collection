// Connectivity probe that needs no tables: GET /auth/v1/health with the anon key.
// 200 = URL reachable and the key is accepted. Used by the dev-only check in main.tsx.
import {toAppError, type AppError} from "./errors.ts";
import type {SupabaseEnv} from "./env.ts";

export type HealthResult =
    | {ok: true; latencyMs: number}
    | {ok: false; error: AppError};

export async function checkSupabaseHealth(env: SupabaseEnv, fetchImpl: typeof fetch = fetch): Promise<HealthResult> {
    const started = performance.now();
    try {
        const response = await fetchImpl(`${env.url}/auth/v1/health`, {
            headers: {apikey: env.anonKey},
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
            return {ok: false, error: toAppError({status: response.status, message: response.statusText})};
        }
        return {ok: true, latencyMs: Math.round(performance.now() - started)};
    } catch (error) {
        return {ok: false, error: toAppError(error)};
    }
}
