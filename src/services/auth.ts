// Owner sign-in (ROADMAP Phase 24): email + password via Supabase Auth; sign-ups are disabled in
// the dashboard, so the only accounts are the ones created there by hand. Whether a signed-in user
// is an admin comes from `diecast.is_admin()` — the same function every RLS policy checks — so the
// UI can never disagree with the database about who may write. Hiding admin UI is a convenience;
// RLS is the real gate.
import {toAppError} from "../lib/errors.ts";
import {supabase} from "../lib/supabase.ts";

import {sameAuthState, toAuthState, type AuthState} from "./auth-state.ts";

// A tiny external store over Supabase's auth events, read with useSyncExternalStore
// (src/hooks/useSession.ts). "loading" until the client has restored (or not found) the stored
// session, so a guarded page never bounces to /login before the session is known.
let state: AuthState = {status: "loading"};
const listeners = new Set<() => void>();
let started = false;

function start() {
    if (started) return;
    started = true;
    // Emits INITIAL_SESSION first (from storage), then SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED /
    // USER_UPDATED — also for sign-ins/outs in other tabs. Never await a Supabase call inside this
    // callback (the client holds a lock while it runs).
    supabase.auth.onAuthStateChange((_event, session) => {
        const next = toAuthState(session);
        if (sameAuthState(state, next)) return;
        state = next;
        for (const listener of listeners) listener();
    });
}

export function subscribeToAuth(listener: () => void): () => void {
    start();
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getAuthState(): AuthState {
    return state;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
    const {error} = await supabase.auth.signInWithPassword({email: email.trim(), password});
    if (error) throw toAppError(error);
}

export async function signOut(): Promise<void> {
    // "local": ends this browser's session only (the owner may be signed in elsewhere too).
    const {error} = await supabase.auth.signOut({scope: "local"});
    if (error) throw toAppError(error);
}

// Asks the database, not the client: the answer RLS will actually apply.
export async function getIsAdmin(): Promise<boolean> {
    const {data, error} = await supabase.rpc("is_admin");
    if (error) throw toAppError(error);
    return data === true;
}
