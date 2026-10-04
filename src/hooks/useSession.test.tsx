import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, renderHook, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ReactNode} from "react";

import type {AuthState} from "../services/auth-state.ts";

// useAdminState() combines the auth store with the is_admin() query (Phase 24). Phase 35: its
// query states — loading, admin, not admin, and an error, which must hide admin UI, not guess.
let state: AuthState = {status: "loading"};
const listeners = new Set<() => void>();
const getIsAdmin = vi.fn();

vi.mock("../services/auth.ts", () => ({
    subscribeToAuth: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
    getAuthState: () => state,
    getIsAdmin: () => getIsAdmin(),
    signOut: vi.fn(),
}));

const {useAdminState, useResetQueriesOnUserChange} = await import("./useSession.ts");

function setAuth(next: AuthState) {
    act(() => {
        state = next;
        for (const listener of listeners) listener();
    });
}

function wrapperWith(client: QueryClient) {
    return ({children}: {children: ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const newClient = () => new QueryClient({defaultOptions: {queries: {retry: false}}});
const user = (id: string) => ({status: "signedIn" as const, user: {id, email: `${id}@example.com`, displayName: null}});

beforeEach(() => {
    state = {status: "loading"};
    getIsAdmin.mockReset();
});
afterEach(cleanup);

describe("useAdminState", () => {
    it("is loading while the session restores, and never asks the database for a signed-out visitor", () => {
        const {result} = renderHook(() => useAdminState(), {wrapper: wrapperWith(newClient())});
        expect(result.current).toEqual({status: "loading"});
        setAuth({status: "signedOut"});
        expect(result.current).toEqual({status: "notAdmin"});
        expect(getIsAdmin).not.toHaveBeenCalled();
    });

    it("is admin only when is_admin() says so", async () => {
        getIsAdmin.mockResolvedValue(true);
        state = user("owner");
        const {result} = renderHook(() => useAdminState(), {wrapper: wrapperWith(newClient())});
        expect(result.current).toEqual({status: "loading"});
        await waitFor(() => expect(result.current).toEqual({status: "admin"}));
    });

    it("is not admin when is_admin() is false or fails", async () => {
        getIsAdmin.mockResolvedValue(false);
        state = user("visitor");
        const first = renderHook(() => useAdminState(), {wrapper: wrapperWith(newClient())});
        await waitFor(() => expect(first.result.current).toEqual({status: "notAdmin"}));

        getIsAdmin.mockRejectedValue({kind: "network", message: "offline", retryable: true});
        state = user("someone");
        const second = renderHook(() => useAdminState(), {wrapper: wrapperWith(newClient())});
        await waitFor(() => expect(second.result.current).toEqual({status: "notAdmin"}));
    });

    it("re-asks for a different user (the answer is cached per user id)", async () => {
        getIsAdmin.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        state = user("owner");
        const {result} = renderHook(() => useAdminState(), {wrapper: wrapperWith(newClient())});
        await waitFor(() => expect(result.current).toEqual({status: "admin"}));
        setAuth(user("other"));
        await waitFor(() => expect(result.current).toEqual({status: "notAdmin"}));
        expect(getIsAdmin).toHaveBeenCalledTimes(2);
    });
});

describe("useResetQueriesOnUserChange", () => {
    it("resets the cache when the user changes, not on the first known state", () => {
        const client = newClient();
        const reset = vi.spyOn(client, "resetQueries");
        renderHook(() => useResetQueriesOnUserChange(), {wrapper: wrapperWith(client)});

        setAuth({status: "signedOut"});
        expect(reset).not.toHaveBeenCalled();
        setAuth(user("owner"));
        expect(reset).toHaveBeenCalledTimes(1);
        setAuth(user("owner")); // same user (token refresh) — no reset
        expect(reset).toHaveBeenCalledTimes(1);
        setAuth({status: "signedOut"});
        expect(reset).toHaveBeenCalledTimes(2);
    });
});
