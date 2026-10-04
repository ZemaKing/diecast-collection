import {beforeEach, describe, expect, it, vi} from "vitest";

// The auth service over a mocked Supabase client (Phase 35): sign-in errors become AppErrors, the
// admin flag comes from the database's is_admin(), and the auth store follows auth events.
type AuthListener = (event: string, session: {user: {id: string; email?: string; user_metadata?: Record<string, unknown>}} | null) => void;

const signInWithPasswordMock = vi.fn();
const signOutMock = vi.fn();
const rpc = vi.fn();
let authListener: AuthListener | null = null;

vi.mock("../lib/supabase.ts", () => ({
    supabase: {
        rpc: (...args: unknown[]) => rpc(...args),
        auth: {
            signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
            signOut: (...args: unknown[]) => signOutMock(...args),
            onAuthStateChange: (listener: AuthListener) => {
                authListener = listener;
                return {data: {subscription: {unsubscribe: () => {}}}};
            },
        },
    },
}));

const {getAuthState, getIsAdmin, signInWithPassword, signOut, subscribeToAuth} = await import("./auth.ts");

beforeEach(() => {
    signInWithPasswordMock.mockReset();
    signOutMock.mockReset();
    rpc.mockReset();
});

describe("signInWithPassword", () => {
    it("trims the email and passes the password unchanged", async () => {
        signInWithPasswordMock.mockResolvedValue({data: {}, error: null});
        await signInWithPassword("  owner@example.com ", " pass word ");
        expect(signInWithPasswordMock).toHaveBeenCalledWith({email: "owner@example.com", password: " pass word "});
    });

    it("turns wrong credentials into a friendly AppError", async () => {
        signInWithPasswordMock.mockResolvedValue({data: {}, error: {name: "AuthApiError", status: 400, code: "invalid_credentials", message: "Invalid login credentials"}});
        await expect(signInWithPassword("a@b.c", "x")).rejects.toMatchObject({kind: "auth", message: "Wrong email or password."});
    });
});

describe("signOut", () => {
    it("signs out this browser only", async () => {
        signOutMock.mockResolvedValue({error: null});
        await signOut();
        expect(signOutMock).toHaveBeenCalledWith({scope: "local"});
    });

    it("rejects with an AppError when Supabase fails", async () => {
        signOutMock.mockResolvedValue({error: {status: 503, message: "down"}});
        await expect(signOut()).rejects.toMatchObject({kind: expect.any(String), retryable: expect.any(Boolean)});
    });
});

describe("getIsAdmin", () => {
    it("asks the database's is_admin()", async () => {
        rpc.mockResolvedValue({data: true, error: null});
        await expect(getIsAdmin()).resolves.toBe(true);
        expect(rpc).toHaveBeenCalledWith("is_admin");
    });

    it("is false for anything but a literal true", async () => {
        rpc.mockResolvedValue({data: null, error: null});
        await expect(getIsAdmin()).resolves.toBe(false);
        rpc.mockResolvedValue({data: "true", error: null});
        await expect(getIsAdmin()).resolves.toBe(false);
    });

    it("throws an AppError on failure (never guesses)", async () => {
        rpc.mockResolvedValue({data: null, error: {code: "42501", message: "permission denied"}});
        await expect(getIsAdmin()).rejects.toMatchObject({kind: "permission"});
    });
});

describe("auth store", () => {
    it("is loading until the first auth event, then follows sign-in / sign-out", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeToAuth(listener);
        expect(getAuthState()).toEqual({status: "loading"});

        authListener!("INITIAL_SESSION", null);
        expect(getAuthState()).toEqual({status: "signedOut"});
        expect(listener).toHaveBeenCalledTimes(1);

        authListener!("SIGNED_IN", {user: {id: "u1", email: "owner@example.com", user_metadata: {display_name: "ZemaKing"}}});
        expect(getAuthState()).toEqual({status: "signedIn", user: {id: "u1", email: "owner@example.com", displayName: "ZemaKing"}});
        expect(listener).toHaveBeenCalledTimes(2);

        // An hourly token refresh re-emits the same user: no notification.
        authListener!("TOKEN_REFRESHED", {user: {id: "u1", email: "owner@example.com", user_metadata: {display_name: "ZemaKing"}}});
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        authListener!("SIGNED_OUT", null);
        expect(getAuthState()).toEqual({status: "signedOut"});
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
