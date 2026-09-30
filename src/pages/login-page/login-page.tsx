import {useId, useState, type FormEvent} from "react";
import {Navigate, useLocation} from "react-router-dom";
import {useMutation} from "@tanstack/react-query";

import {Header} from "../../components/Header/Header";

import {useModelCount} from "../../hooks/useModelCount.ts";
import {useSession} from "../../hooks/useSession.ts";
import type {AppError} from "../../lib/errors.ts";
import {safeRedirectPath} from "../../services/auth-state.ts";
import {signInWithPassword} from "../../services/auth.ts";

import "./login-page.css";

// `/login` (ROADMAP Phase 24) — the owner's email + password sign-in. There's no sign-up link and
// no "forgot password": sign-ups are disabled in Supabase and the only accounts are created in the
// dashboard (docs/SUPABASE-SETUP.md), where a password is reset too. Nothing public links here —
// visitors never need an account. No mockup exists; built from the design system.
export function LoginPage() {
    const session = useSession();
    const location = useLocation();
    const count = useModelCount();
    const emailId = useId();
    const passwordId = useId();
    const errorId = useId();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const signIn = useMutation<void, AppError, {email: string; password: string}>({
        mutationFn: ({email, password}) => signInWithPassword(email, password),
        // The password never outlives a failed attempt in state.
        onError: () => setPassword(""),
    });

    // Signed in (just now, or already) → back to the page that sent you here, else the dashboard.
    if (session.status === "signedIn") {
        return <Navigate to={safeRedirectPath(location.state)} replace/>;
    }

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!signIn.isPending) signIn.mutate({email, password});
    };

    const error = signIn.error;

    return (
        <div className="layout">
            <Header count={count}/>

            <main className="loginMain">
                <form className="loginCard" onSubmit={submit} aria-labelledby="login-title">
                    <p className="loginEyebrow">Owner</p>
                    <h1 id="login-title" className="loginTitle">Sign in</h1>
                    <p className="loginLead">Managing the collection needs the owner account. Browsing never does.</p>

                    <label className="loginField" htmlFor={emailId}>
                        <span className="loginLabel">Email</span>
                        <input
                            id={emailId}
                            className="loginInput"
                            type="email"
                            name="email"
                            autoComplete="username"
                            inputMode="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            disabled={session.status === "loading"}
                        />
                    </label>

                    <label className="loginField" htmlFor={passwordId}>
                        <span className="loginLabel">Password</span>
                        <input
                            id={passwordId}
                            className="loginInput"
                            type="password"
                            name="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            disabled={session.status === "loading"}
                        />
                    </label>

                    {error && (
                        <p id={errorId} className="loginError" role="alert">
                            {error.message}
                        </p>
                    )}

                    <button type="submit" className="loginSubmit" disabled={signIn.isPending || session.status === "loading"}>
                        {signIn.isPending ? "Signing in…" : "Sign in"}
                    </button>
                </form>
            </main>
        </div>
    );
}
