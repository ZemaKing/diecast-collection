// Auth state for components (ROADMAP Phase 24). `useSession()` is the signed-in user (or
// "loading" / "signedOut"); `useIsAdmin()` asks the database's `is_admin()` — the function RLS
// itself uses — and is only ever a convenience for showing/hiding admin UI, never the gate.
import {useEffect, useRef, useSyncExternalStore} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useLocation, useNavigate} from "react-router-dom";

import type {AppError} from "../lib/errors.ts";
import type {AuthState} from "../services/auth-state.ts";
import {getAuthState, getIsAdmin, signOut, subscribeToAuth} from "../services/auth.ts";

export function useSession(): AuthState {
    return useSyncExternalStore(subscribeToAuth, getAuthState);
}

export type AdminState = {status: "loading"} | {status: "admin"} | {status: "notAdmin"};

export function useAdminState(): AdminState {
    const session = useSession();
    const userId = session.status === "signedIn" ? session.user.id : null;
    const query = useQuery<boolean, AppError>({
        queryKey: ["auth", "is-admin", userId],
        queryFn: getIsAdmin,
        enabled: userId !== null,
    });

    if (session.status === "loading") return {status: "loading"};
    if (session.status === "signedOut") return {status: "notAdmin"};
    if (query.isPending) return {status: "loading"};
    // An error (offline, …) hides admin UI rather than guessing; RLS would refuse writes anyway.
    return query.data === true ? {status: "admin"} : {status: "notAdmin"};
}

export function useIsAdmin(): boolean {
    return useAdminState().status === "admin";
}

// Mounted once (App): when the signed-in user changes — sign-in, sign-out, a different account,
// or the same in another tab — every cached query is reset. Reads depend on who's asking (an
// admin also sees unpublished drafts through RLS), so data fetched as one user must never be shown
// to the next. A deliberate effect: it syncs the query cache to an external event, nothing else.
export function useResetQueriesOnUserChange() {
    const session = useSession();
    const queryClient = useQueryClient();
    const userId = session.status === "signedIn" ? session.user.id : session.status === "signedOut" ? null : undefined;
    const previous = useRef<string | null | undefined>(undefined);

    useEffect(() => {
        if (userId === undefined) return; // still restoring the session
        if (previous.current !== undefined && previous.current !== userId) {
            void queryClient.resetQueries();
        }
        previous.current = userId;
    }, [userId, queryClient]);
}

// Sign out from anywhere. On an /admin page it first leaves for the collection — otherwise the
// guard would see the session end and bounce through /login on the way out.
export function useSignOut() {
    const navigate = useNavigate();
    const location = useLocation();
    return useMutation<void, AppError>({
        mutationFn: async () => {
            if (location.pathname === "/admin" || location.pathname.startsWith("/admin/")) {
                navigate("/", {replace: true});
            }
            await signOut();
        },
    });
}
