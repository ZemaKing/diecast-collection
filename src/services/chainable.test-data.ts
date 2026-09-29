// Test-only: a minimal stand-in for a PostgrestFilterBuilder. Every chain method (select/eq/
// order/limit/single) returns the same object; `then` resolves it — so `await chain(...)` and
// `await supabase.from(t).select(...).eq(...).order(...)` behave the same regardless of which
// methods a service happens to call. Not a .test.ts file, so Vitest won't try to run it as a suite.
export type QueryResult<T> = {data: T; error: null} | {data: null; error: {message: string; code?: string; status?: number}};

export function chainable<T>(result: QueryResult<T>) {
    const self: Record<string, unknown> = {
        select: () => self,
        eq: () => self,
        order: () => self,
        limit: () => self,
        single: () => self,
        maybeSingle: () => self,
        then: (onFulfilled: (r: QueryResult<T>) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve(result).then(onFulfilled, onRejected),
    };
    return self;
}
