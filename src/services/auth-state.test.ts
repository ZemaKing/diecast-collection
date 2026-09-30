import {describe, expect, it} from "vitest";

import {safeRedirectPath, sameAuthState, toAuthState, userInitials, type AuthState} from "./auth-state.ts";

const session = (user: {id: string; email?: string; user_metadata?: Record<string, unknown>}) =>
    ({user: {app_metadata: {}, aud: "authenticated", created_at: "", user_metadata: {}, ...user}}) as unknown as Parameters<typeof toAuthState>[0];

describe("toAuthState", () => {
    it("maps no session to signed out", () => {
        expect(toAuthState(null)).toEqual({status: "signedOut"});
    });

    it("maps a session to the signed-in user, with a display name from the metadata", () => {
        expect(toAuthState(session({id: "u1", email: "owner@example.com", user_metadata: {display_name: " ZemaKing "}}))).toEqual({
            status: "signedIn",
            user: {id: "u1", email: "owner@example.com", displayName: "ZemaKing"},
        });
        expect(toAuthState(session({id: "u2", user_metadata: {full_name: "Test User"}}))).toMatchObject({user: {email: null, displayName: "Test User"}});
        expect(toAuthState(session({id: "u3", user_metadata: {name: 42}}))).toMatchObject({user: {displayName: null}});
    });
});

describe("sameAuthState", () => {
    const signedIn = (id: string, email = "a@b.c"): AuthState => ({status: "signedIn", user: {id, email, displayName: null}});

    it("treats a token refresh for the same user as no change", () => {
        expect(sameAuthState(signedIn("u1"), signedIn("u1"))).toBe(true);
        expect(sameAuthState({status: "signedOut"}, {status: "signedOut"})).toBe(true);
    });

    it("sees sign-in, sign-out, a different user and a changed email", () => {
        expect(sameAuthState({status: "loading"}, {status: "signedOut"})).toBe(false);
        expect(sameAuthState({status: "signedOut"}, signedIn("u1"))).toBe(false);
        expect(sameAuthState(signedIn("u1"), signedIn("u2"))).toBe(false);
        expect(sameAuthState(signedIn("u1"), signedIn("u1", "new@b.c"))).toBe(false);
    });
});

describe("userInitials", () => {
    it("uses a CamelCase single word's capitals, or first + last word", () => {
        expect(userInitials({displayName: "ZemaKing", email: null})).toBe("ZK");
        expect(userInitials({displayName: "Milos Radulovic", email: null})).toBe("MR");
        expect(userInitials({displayName: "anna maria smith", email: null})).toBe("AS");
        expect(userInitials({displayName: "owner", email: null})).toBe("O");
    });

    it("falls back to the email's first letter, then '?'", () => {
        expect(userInitials({displayName: null, email: "zema@example.com"})).toBe("Z");
        expect(userInitials({displayName: "  ", email: null})).toBe("?");
    });
});

describe("safeRedirectPath", () => {
    it("returns the in-app page that sent you to /login", () => {
        expect(safeRedirectPath({from: "/admin"})).toBe("/admin");
        expect(safeRedirectPath({from: "/admin/models/new?x=1"})).toBe("/admin/models/new?x=1");
    });

    it("never redirects off-site, back to /login, or on malformed state", () => {
        expect(safeRedirectPath({from: "https://evil.example"})).toBe("/admin");
        expect(safeRedirectPath({from: "//evil.example"})).toBe("/admin");
        expect(safeRedirectPath({from: "/login"})).toBe("/admin");
        expect(safeRedirectPath({from: 42})).toBe("/admin");
        expect(safeRedirectPath(null)).toBe("/admin");
        expect(safeRedirectPath(undefined, "/")).toBe("/");
    });
});
