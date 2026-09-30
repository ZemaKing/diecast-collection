import {useEffect, useId, useRef, useState} from "react";
import {Link, useLocation} from "react-router-dom";

import {useIsAdmin, useSession, useSignOut} from "../../hooks/useSession.ts";
import {userInitials} from "../../services/auth-state.ts";

// The signed-in owner's avatar ("ZK") and its menu (ROADMAP Phase 24): who's signed in, the admin
// dashboard (admins only) and Sign out. Renders nothing when signed out — visitors never see
// account UI, and nothing public links to /login. A disclosure (button + list of links), not an
// ARIA menu: Tab moves through it, Escape or a click outside closes it and returns focus.
export function AccountMenu() {
    const session = useSession();
    const isAdmin = useIsAdmin();
    const signOut = useSignOut();
    const location = useLocation();
    // Open = "opened on this history entry": any navigation closes it, with no effect to sync.
    const [openedOn, setOpenedOn] = useState<string | null>(null);
    const open = openedOn === location.key;
    const buttonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const panelId = useId();

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setOpenedOn(null);
            buttonRef.current?.focus();
        };
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpenedOn(null);
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open]);

    if (session.status !== "signedIn") return null;
    const {user} = session;

    return (
        <div className="accountMenu">
            <button
                ref={buttonRef}
                type="button"
                className="accountAvatar"
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={`Account: ${user.email ?? "signed in"}`}
                onClick={() => setOpenedOn(open ? null : location.key)}
            >
                {userInitials(user)}
            </button>

            {open && (
                <div ref={panelRef} id={panelId} className="accountPanel">
                    <div className="accountIdentity">
                        <span className="accountRole">{isAdmin ? "Admin" : "Signed in"}</span>
                        <span className="accountEmail">{user.email}</span>
                    </div>
                    <ul className="accountLinks">
                        {isAdmin && (
                            <li>
                                <Link to="/admin" className="accountLink">Dashboard</Link>
                            </li>
                        )}
                        <li>
                            <button
                                type="button"
                                className="accountLink"
                                onClick={() => signOut.mutate()}
                                disabled={signOut.isPending}
                            >
                                {signOut.isPending ? "Signing out…" : "Sign out"}
                            </button>
                        </li>
                    </ul>
                    {signOut.isError && <p className="accountError" role="alert">{signOut.error.message}</p>}
                </div>
            )}
        </div>
    );
}
