import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {MemoryRouter, Route, Routes, useLocation} from "react-router-dom";

import type {AuthState} from "../../services/auth-state.ts";
import type {AdminState} from "../../hooks/useSession.ts";

// The /admin guard (Phase 24) as a component (Phase 35): signed out → /login remembering where you
// were going, loading → "Checking access…", not an admin → 403, admin → the page.
let session: AuthState = {status: "loading"};
let admin: AdminState = {status: "loading"};
const signOut = vi.fn();

vi.mock("../../hooks/useSession.ts", () => ({
    useSession: () => session,
    useAdminState: () => admin,
    useSignOut: () => ({mutate: signOut, isPending: false}),
}));
// The header needs the query cache and Supabase; it isn't what's under test.
vi.mock("../Header/Header", () => ({Header: () => <header/>}));

const {AdminRoute} = await import("./AdminRoute.tsx");

function LoginProbe() {
    const location = useLocation();
    return <p>login page, from {(location.state as {from?: string} | null)?.from ?? "nowhere"}</p>;
}

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/login" element={<LoginProbe/>}/>
                <Route path="/admin" element={<AdminRoute/>}>
                    <Route index element={<p>admin dashboard</p>}/>
                    <Route path="data" element={<p>supporting data</p>}/>
                </Route>
            </Routes>
        </MemoryRouter>,
    );
}

const owner = {id: "u1", email: "owner@example.com", displayName: null};

beforeEach(() => {
    signOut.mockReset();
});
afterEach(cleanup);

describe("AdminRoute", () => {
    it("redirects a signed-out visitor to /login with the page they wanted", () => {
        session = {status: "signedOut"};
        admin = {status: "notAdmin"};
        renderAt("/admin/data?tab=brands");
        expect(screen.getByText("login page, from /admin/data?tab=brands")).toBeTruthy();
        expect(screen.queryByText("supporting data")).toBeNull();
    });

    it("shows 'Checking access…' while the session or admin check is loading, never the page", () => {
        session = {status: "loading"};
        admin = {status: "loading"};
        renderAt("/admin");
        expect(screen.getByRole("status").textContent).toBe("Checking access…");
        expect(screen.queryByText("admin dashboard")).toBeNull();

        cleanup();
        session = {status: "signedIn", user: owner};
        renderAt("/admin");
        expect(screen.getByRole("status").textContent).toBe("Checking access…");
    });

    it("shows a 403 to a signed-in non-admin, with a way to sign out", () => {
        session = {status: "signedIn", user: owner};
        admin = {status: "notAdmin"};
        renderAt("/admin");
        expect(screen.getByRole("heading", {level: 1}).textContent).toBe("No admin access");
        expect(screen.getByText("owner@example.com")).toBeTruthy();
        expect(screen.queryByText("admin dashboard")).toBeNull();

        screen.getByRole("button", {name: "Sign out"}).click();
        expect(signOut).toHaveBeenCalledOnce();
    });

    it("renders the requested admin page for an admin", () => {
        session = {status: "signedIn", user: owner};
        admin = {status: "admin"};
        renderAt("/admin/data");
        expect(screen.getByText("supporting data")).toBeTruthy();
    });
});
