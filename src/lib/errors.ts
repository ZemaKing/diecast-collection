// One error shape for the whole app. Services call toAppError() on anything thrown or returned
// by Supabase (PostgREST, Auth, Storage, fetch) so UI code only branches on `kind`.
import {EnvError} from "./env.ts";

export type AppErrorKind =
    | "network"      // offline, DNS, CORS, fetch aborted — the request never got an answer
    | "unavailable"  // Supabase answered 5xx, e.g. project paused or overloaded
    | "auth"         // not signed in / session expired / bad credentials
    | "permission"   // signed in (or anon) but RLS or a grant said no
    | "not_found"
    | "conflict"     // unique or foreign-key violation (duplicate slug, lookup still in use)
    | "validation"   // CHECK / NOT NULL / bad input format
    | "config"       // missing or unsafe env
    | "unknown";

export type AppError = {
    kind: AppErrorKind;
    message: string;       // safe to show the user
    retryable: boolean;    // worth showing a "Try again" button
    code?: string;         // Postgres / PostgREST / Auth code, for logs
    status?: number;       // HTTP status when known
    cause?: unknown;       // original error, for logs only
};

const USER_MESSAGES: Record<AppErrorKind, string> = {
    network: "Can't reach the server. Check your connection and try again.",
    unavailable: "The collection is temporarily unavailable. Please try again in a moment.",
    auth: "Please sign in again.",
    permission: "You don't have permission to do that.",
    not_found: "That item couldn't be found.",
    conflict: "That conflicts with existing data.",
    validation: "Some of the data isn't valid.",
    config: "The app isn't configured correctly.",
    unknown: "Something went wrong.",
};

const RETRYABLE = new Set<AppErrorKind>(["network", "unavailable", "unknown"]);

// Postgres SQLSTATE → kind. https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_CODES: Record<string, AppErrorKind> = {
    "23505": "conflict",   // unique_violation
    "23503": "conflict",   // foreign_key_violation
    "23514": "validation", // check_violation
    "23502": "validation", // not_null_violation
    "22P02": "validation", // invalid_text_representation (e.g. bad uuid)
    "22001": "validation", // string_data_right_truncation
    "42501": "permission", // insufficient_privilege / RLS violation
};

// Errors our own SQL functions raise for the user (class ZK — e.g. diecast.save_model(), Phase 25).
// Their message is written for people, so it's shown as-is instead of the generic one.
const ZK_CODES: Record<string, AppErrorKind> = {
    ZK404: "not_found",
    ZK409: "conflict",
    ZK422: "validation",
};

// PostgREST codes. https://postgrest.org/en/stable/references/errors.html
const PGRST_CODES: Record<string, AppErrorKind> = {
    PGRST116: "not_found", // .single() matched 0 rows
    PGRST301: "auth",      // JWT invalid / expired
    PGRST302: "auth",      // anonymous access disabled
    PGRST303: "auth",      // JWT claims validation failed
};

type ErrorLike = {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
};

function asErrorLike(value: unknown): ErrorLike | null {
    return typeof value === "object" && value !== null ? (value as ErrorLike) : null;
}

function kindFromStatus(status: number | undefined): AppErrorKind | undefined {
    if (status === undefined) return undefined;
    if (status === 401) return "auth";
    if (status === 403) return "permission";
    if (status === 404) return "not_found";
    if (status === 409) return "conflict";
    if (status === 400 || status === 422) return "validation";
    if (status >= 500) return "unavailable";
    return undefined;
}

function isNetworkFailure(e: ErrorLike): boolean {
    const name = typeof e.name === "string" ? e.name : "";
    const message = typeof e.message === "string" ? e.message : "";
    return (
        name === "AbortError" ||
        name === "AuthRetryableFetchError" ||
        (name === "StorageUnknownError" && /fetch/i.test(message)) ||
        /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(message)
    );
}

function make(kind: AppErrorKind, extra: Partial<AppError> = {}): AppError {
    return {kind, message: USER_MESSAGES[kind], retryable: RETRYABLE.has(kind), ...extra};
}

export function isAppError(value: unknown): value is AppError {
    const e = asErrorLike(value) as Partial<AppError> | null;
    return !!e && typeof e.kind === "string" && typeof e.retryable === "boolean" && typeof e.message === "string";
}

export function toAppError(error: unknown): AppError {
    if (isAppError(error)) return error;
    if (error instanceof EnvError) return make("config", {cause: error});

    const e = asErrorLike(error);
    if (!e) return make("unknown", {cause: error});

    const code = typeof e.code === "string" ? e.code : undefined;
    const status = typeof e.status === "number" ? e.status : undefined;
    const base = {code, status, cause: error};

    if (isNetworkFailure(e)) return make("network", base);
    if (code && ZK_CODES[code]) {
        const message = typeof e.message === "string" && e.message.trim() ? e.message : undefined;
        return make(ZK_CODES[code], message ? {...base, message} : base);
    }
    if (code && PG_CODES[code]) return make(PG_CODES[code], base);
    if (code && PGRST_CODES[code]) return make(PGRST_CODES[code], base);

    // Auth errors (AuthApiError etc.) carry an HTTP status and sometimes a string code.
    if (code === "invalid_credentials") return make("auth", {...base, message: "Wrong email or password."});
    if (code === "session_not_found" || code === "refresh_token_not_found") return make("auth", base);

    return make(kindFromStatus(status) ?? "unknown", base);
}
