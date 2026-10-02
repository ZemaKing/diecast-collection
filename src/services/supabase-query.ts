// Shared glue between services and the Supabase client: every query response is normalized
// through toAppError() here, so services never handle raw PostgREST/network errors themselves.
import {toAppError} from "../lib/errors.ts";

type QueryResult<T> = {
    data: T | null;
    error: {message: string; code?: string; details?: string; hint?: string} | null;
    // The HTTP status of the response. PostgREST's error object doesn't carry it, so an answer
    // with no Postgres code (a 503, or 540 "Project paused" — Phase 29) would otherwise be "unknown".
    status?: number;
};

export async function unwrap<T>(query: PromiseLike<QueryResult<T>>): Promise<T> {
    const {data, error, status} = await query;
    if (error) throw toAppError(status ? {...error, status} : error);
    if (data === null) throw toAppError({code: "PGRST116", message: "Not found"});
    return data;
}
