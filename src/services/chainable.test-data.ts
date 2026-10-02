// Test-only: a minimal stand-in for a PostgrestFilterBuilder. Every chain method (select/eq/
// order/limit/single) returns the same object; `then` resolves it — so `await chain(...)` and
// `await supabase.from(t).select(...).eq(...).order(...)` behave the same regardless of which
// methods a service happens to call. Not a .test.ts file, so Vitest won't try to run it as a suite.
export type QueryResult<T> = {data: T; error: null} | {data: null; error: {message: string; code?: string; status?: number}};

export function chainable<T>(result: QueryResult<T>) {
    // Every chain call, in order — so a test can assert e.g. ["eq", ["is_published", true]].
    const calls: [string, unknown[]][] = [];
    const record = (name: string) => (...args: unknown[]) => {
        calls.push([name, args]);
        return self;
    };
    const self: Record<string, unknown> = {
        calls,
        select: record("select"),
        eq: record("eq"),
        order: record("order"),
        limit: record("limit"),
        single: record("single"),
        maybeSingle: record("maybeSingle"),
        delete: record("delete"),
        insert: record("insert"),
        update: record("update"),
        in: record("in"),
        then: (onFulfilled: (r: QueryResult<T>) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve(result).then(onFulfilled, onRejected),
    };
    return self;
}
