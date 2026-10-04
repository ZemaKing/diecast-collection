import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {MemoryRouter, Route, Routes} from "react-router-dom";

import type {AuthState} from "../../services/auth-state.ts";

// The sign-in form (Phase 24) as a component (Phase 35): submits trimmed credentials, shows the
// error and forgets the password after a failure, and sends a signed-in owner where they were going.
let session: AuthState = {status: "signedOut"};
const signInWithPassword = vi.fn();

vi.mock("../../hooks/useSession.ts", () => ({useSession: () => session}));
vi.mock("../../services/auth.ts", () => ({signInWithPassword: (...args: unknown[]) => signInWithPassword(...args)}));
vi.mock("../../components/Header/Header", () => ({Header: () => <header/>}));

const {LoginPage} = await import("./login-page.tsx");

function renderLogin(state?: unknown) {
    const client = new QueryClient({defaultOptions: {mutations: {retry: false}}});
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[{pathname: "/login", state}]}>
                <Routes>
                    <Route path="/login" element={<LoginPage/>}/>
                    <Route path="/admin" element={<p>dashboard</p>}/>
                    <Route path="/admin/data" element={<p>supporting data</p>}/>
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

const email = () => screen.getByLabelText("Email") as HTMLInputElement;
const password = () => screen.getByLabelText("Password") as HTMLInputElement;

beforeEach(() => {
    session = {status: "signedOut"};
    signInWithPassword.mockReset();
});
afterEach(cleanup);

describe("LoginPage", () => {
    it("submits the email and password", async () => {
        signInWithPassword.mockResolvedValue(undefined);
        renderLogin();
        fireEvent.change(email(), {target: {value: "owner@example.com"}});
        fireEvent.change(password(), {target: {value: "secret"}});
        fireEvent.click(screen.getByRole("button", {name: "Sign in"}));
        await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith("owner@example.com", "secret"));
    });

    it("shows the error as an alert and clears the password after a failed attempt", async () => {
        signInWithPassword.mockRejectedValue({kind: "auth", message: "Wrong email or password.", retryable: false});
        renderLogin();
        fireEvent.change(email(), {target: {value: "owner@example.com"}});
        fireEvent.change(password(), {target: {value: "wrong"}});
        fireEvent.submit(email().form!);

        expect((await screen.findByRole("alert")).textContent).toBe("Wrong email or password.");
        expect(password().value).toBe("");
        expect(email().value).toBe("owner@example.com");
        expect(email().getAttribute("aria-invalid")).toBe("true");
    });

    it("disables the form while the session is still being restored", () => {
        session = {status: "loading"};
        renderLogin();
        expect(email().disabled).toBe(true);
        expect((screen.getByRole("button", {name: "Sign in"}) as HTMLButtonElement).disabled).toBe(true);
    });

    it("sends a signed-in owner back to the page that asked, else the dashboard", () => {
        session = {status: "signedIn", user: {id: "u1", email: "owner@example.com", displayName: null}};
        renderLogin({from: "/admin/data"});
        expect(screen.getByText("supporting data")).toBeTruthy();

        cleanup();
        renderLogin({from: "https://evil.example.com/"});
        expect(screen.getByText("dashboard")).toBeTruthy();
    });
});
