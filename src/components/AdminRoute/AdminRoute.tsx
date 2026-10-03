import {Navigate, Outlet, useLocation} from "react-router-dom";

import {Header} from "../Header/Header";

import {useAdminState, useSession, useSignOut} from "../../hooks/useSession.ts";

import "./AdminRoute.css";

// Layout route for everything under /admin (ROADMAP Phase 24). Signed out → /login, remembering
// where you were going; signed in but not an admin → a plain "no access" page (no redirect loop);
// admin → the page. This is a convenience for the owner, not security: every admin write is still
// checked by RLS (`diecast.is_admin()`), whatever the browser renders.
export function AdminRoute() {
    const session = useSession();
    const admin = useAdminState();
    const location = useLocation();

    if (session.status === "signedOut") {
        return <Navigate to="/login" state={{from: location.pathname + location.search}} replace/>;
    }

    if (admin.status === "admin") return <Outlet/>;

    return <AdminGate state={admin.status === "loading" ? "checking" : "denied"} email={session.status === "signedIn" ? session.user.email : null}/>;
}

function AdminGate({state, email}: {state: "checking" | "denied"; email: string | null}) {
    const signOut = useSignOut();

    return (
        <div className="layout">
            <Header/>
            <main className="adminGate">
                {state === "checking" ? (
                    <p className="adminGateChecking" role="status">Checking access…</p>
                ) : (
                    <div className="adminGateCard">
                        <span className="adminGateCode">403</span>
                        <h1 className="adminGateTitle">No admin access</h1>
                        <p className="adminGateBody">
                            {email ? <>You're signed in as <strong>{email}</strong>, which isn't an admin account.</> : "This account isn't an admin account."}
                        </p>
                        <button type="button" className="adminGateButton" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
                            Sign out
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
