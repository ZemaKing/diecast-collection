// Pure auth helpers (ROADMAP Phase 24) — no Supabase client, so they're unit-tested directly.
import type {Session} from "@supabase/supabase-js";

export type AuthUser = {
    id: string;
    email: string | null;
    // `user_metadata.display_name` / `full_name` / `name`, when set in the dashboard.
    displayName: string | null;
};

export type AuthState =
    | {status: "loading"}
    | {status: "signedOut"}
    | {status: "signedIn"; user: AuthUser};

function metadataName(metadata: Record<string, unknown> | undefined): string | null {
    for (const key of ["display_name", "full_name", "name"]) {
        const value = metadata?.[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
}

export function toAuthState(session: Pick<Session, "user"> | null): AuthState {
    if (!session) return {status: "signedOut"};
    const {user} = session;
    return {status: "signedIn", user: {id: user.id, email: user.email ?? null, displayName: metadataName(user.user_metadata)}};
}

// Token refreshes re-emit the same user every hour; treating that as "no change" keeps every
// subscriber from re-rendering (and the query cache from being reset) for nothing.
export function sameAuthState(a: AuthState, b: AuthState): boolean {
    if (a.status !== b.status) return false;
    if (a.status !== "signedIn" || b.status !== "signedIn") return true;
    return a.user.id === b.user.id && a.user.email === b.user.email && a.user.displayName === b.user.displayName;
}

// The avatar's letters: "ZemaKing" → "ZK" (a single CamelCase word gives its capitals), "Milos
// Radulovic" → "MR", no name → the email's first letter, nothing at all → "?".
export function userInitials(user: Pick<AuthUser, "displayName" | "email">): string {
    const name = user.displayName?.trim();
    if (name) {
        const words = name.split(/\s+/).filter(Boolean);
        if (words.length > 1) return (words[0]![0]! + words.at(-1)![0]!).toUpperCase();
        const capitals = name.match(/\p{Lu}/gu);
        if (capitals && capitals.length > 1) return capitals.slice(0, 2).join("");
        return name[0]!.toUpperCase();
    }
    const email = user.email?.trim();
    return email ? email[0]!.toUpperCase() : "?";
}

// Where to go after signing in: back to the guarded page that sent you to /login, if it was an
// in-app path — never an absolute or protocol-relative URL (history state is untrusted input).
export function safeRedirectPath(state: unknown, fallback = "/admin"): string {
    const from = (state as {from?: unknown} | null)?.from;
    return typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/login") ? from : fallback;
}
