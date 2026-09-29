// Shared glue between services and the Supabase client: every query response is normalized
// through toAppError() here, so services never handle raw PostgREST/network errors themselves.
import {toAppError} from "../lib/errors.ts";

type QueryResult<T> = {data: T | null; error: {message: string; code?: string; details?: string; hint?: string} | null};

export async function unwrap<T>(query: PromiseLike<QueryResult<T>>): Promise<T> {
    const {data, error} = await query;
    if (error) throw toAppError(error);
    if (data === null) throw toAppError({code: "PGRST116", message: "Not found"});
    return data;
}
