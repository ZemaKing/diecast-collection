// Build-time stand-in for @supabase/realtime-js (Phase 33). vite.config.ts aliases the package to
// this file: supabase-js always constructs a RealtimeClient, but this app never opens a channel,
// and the real one (with its Phoenix socket dependency) was ~57 kB of minified JS on every page.
// It implements exactly what SupabaseClient calls on `this.realtime`; realtime-stub.test.ts reads
// the installed supabase-js and fails if an upgrade starts calling anything else. To use Realtime
// one day, delete the alias (and this file).
export class RealtimeClient {
    setAuth(): Promise<void> {
        return Promise.resolve();
    }

    channel(): never {
        throw new Error("Supabase Realtime isn't bundled in this app — see src/lib/realtime-stub.ts.");
    }

    getChannels(): never[] {
        return [];
    }

    removeChannel(): Promise<"ok"> {
        return Promise.resolve("ok");
    }

    removeAllChannels(): Promise<"ok"[]> {
        return Promise.resolve([]);
    }
}
