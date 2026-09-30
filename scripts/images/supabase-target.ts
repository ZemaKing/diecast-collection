// Supabase Storage as the pipeline's StorageTarget, plus the service-role client the scripts use.
// The service key bypasses RLS: it lives in .env.local and these scripts run nowhere but your machine.
import {createClient, type SupabaseClient} from "@supabase/supabase-js";

import type {StorageTarget} from "./types.ts";

export function keyRole(key: string): string {
    if (key.startsWith("sb_secret_")) return "service_role";
    try {
        return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role ?? "unknown";
    } catch {
        return "unknown";
    }
}

export function projectUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string {
    const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.trim().replace(/\/+$/, "");
    if (!url) throw new Error("Set SUPABASE_URL (or VITE_SUPABASE_URL) in .env.local.");
    return url;
}

export function createServiceClient(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
    const url = projectUrlFromEnv(env);
    const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!key) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY in .env.local (never with a VITE_ prefix).");
    const role = keyRole(key);
    if (role !== "service_role") throw new Error(`SUPABASE_SERVICE_ROLE_KEY is not a service-role key (role: ${role}).`);
    return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}

// "Object not found" comes back as 400 or 404 depending on the Storage version.
const isNotFound = (error: {message?: string; status?: unknown}) =>
    Number(error.status) === 404 || /not.?found/i.test(error.message ?? "");

export function supabaseTarget(supabase: SupabaseClient, bucket: string): StorageTarget {
    const files = () => supabase.storage.from(bucket);
    return {
        async stat(path) {
            const {data, error} = await files().info(path);
            if (error) {
                if (isNotFound(error) && !/bucket/i.test(error.message)) return null;
                throw error;
            }
            return {size: data.size ?? -1};
        },
        async upload(path, data, {contentType, cacheControl}) {
            const {error} = await files().upload(path, data, {contentType, cacheControl, upsert: true});
            if (error) throw error;
        },
        publicUrl: (path) => files().getPublicUrl(path).data.publicUrl,
    };
}

// Before a real run: the bucket must exist and be public, or every public URL would 400.
export async function checkBucket(supabase: SupabaseClient, bucket: string): Promise<void> {
    const {data, error} = await supabase.storage.getBucket(bucket);
    if (error || !data) throw new Error(`Bucket "${bucket}" not found (${error?.message ?? "no data"}) — apply its migration first.`);
    if (!data.public) throw new Error(`Bucket "${bucket}" is not public.`);
}
