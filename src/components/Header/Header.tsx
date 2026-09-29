import {useEffect, useId, useRef, useState} from "react";
import {Link, NavLink} from "react-router-dom";

import {Close} from "../../icons/Close.tsx";
import {Email} from "../../icons/Email.tsx";
import {Instagram} from "../../icons/Instagram.tsx";
import {Menu} from "../../icons/Menu.tsx";
import {Search} from "../../icons/Search.tsx";
import {MEDIA} from "../../styles/breakpoints.ts";
import {ThemeToggle} from "../ThemeToggle/ThemeToggle.tsx";

import "./Header.css";

type Props = {
    count: number;
};

// Only routes that actually resolve to a real page today — Manufacturers/Statistics/Login land
// in Phases 22-24, and adding a nav link before then would violate "nav only links to pages that
// exist" (ROADMAP Phase 12).
const NAV_LINKS = [
    {to: "/", label: "Collection", end: true},
    {to: "/about", label: "About", end: false},
];

function navLinkClass({isActive}: {isActive: boolean}) {
    return `siteNavLink${isActive ? " siteNavLinkActive" : ""}`;
}

function mobileNavLinkClass({isActive}: {isActive: boolean}) {
    return `mobileNavLink${isActive ? " mobileNavLinkActive" : ""}`;
}

export function Header({count}: Props) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const drawerId = useId();

    const closeMenu = () => setIsMenuOpen(false);

    useEffect(() => {
        if (!isMenuOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setIsMenuOpen(false);
            menuButtonRef.current?.focus();
        };
        document.addEventListener("keydown", onKeyDown);

        // The drawer is mobile-only content; if a resize (or rotation) crosses into
        // tablet/desktop, the inline nav takes over and a stuck-open drawer would double up.
        const tabletUp = window.matchMedia(MEDIA.tabletUp);
        const onTabletUp = (e: MediaQueryListEvent) => {
            if (e.matches) setIsMenuOpen(false);
        };
        tabletUp.addEventListener("change", onTabletUp);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            tabletUp.removeEventListener("change", onTabletUp);
        };
    }, [isMenuOpen]);

    return (
        <header className="siteHeader">
            <div className="siteHeaderInner">
                <Link className="siteLogo" to="/" onClick={closeMenu}>
                    <img src="/favicon.svg" alt="" className="siteLogoIcon" width={40} height={40}/>
                    <span className="siteLogoText">
                        <span className="siteLogoName">ZemaKing</span>
                        <span className="siteLogoTagline">Diecast Collection</span>
                    </span>
                </Link>

                <nav className="siteNav" aria-label="Primary">
                    {NAV_LINKS.map(({to, label, end}) => (
                        <NavLink key={to} to={to} end={end} className={navLinkClass}>
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <label className="siteSearch">
                    <Search className="siteSearchIcon"/>
                    <input
                        type="search"
                        placeholder="Search models…"
                        disabled
                        aria-label="Search (coming soon)"
                        title="Search is coming in a future update"
                    />
                </label>

                <div className="siteHeaderActions">
                    <span className="modelCountPill">{count} models</span>
                    <ThemeToggle/>
                    <a
                        className="socialLink"
                        href="https://www.instagram.com/zemaking89/"
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Instagram"
                    >
                        <Instagram width={18} height={18}/>
                    </a>
                    <a className="socialLink" href="mailto:zematule@gmail.com" aria-label="Email">
                        <Email width={18} height={18}/>
                    </a>
                    <button
                        ref={menuButtonRef}
                        type="button"
                        className="menuButton"
                        onClick={() => setIsMenuOpen((open) => !open)}
                        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={isMenuOpen}
                        aria-controls={drawerId}
                    >
                        {isMenuOpen ? <Close/> : <Menu/>}
                    </button>
                </div>
            </div>

            {isMenuOpen && (
                <div id={drawerId} className="mobileDrawer" role="dialog" aria-modal="true" aria-label="Menu">
                    <nav className="mobileNav" aria-label="Primary">
                        {NAV_LINKS.map(({to, label, end}) => (
                            <NavLink key={to} to={to} end={end} onClick={closeMenu} className={mobileNavLinkClass}>
                                {label}
                            </NavLink>
                        ))}
                    </nav>

                    <label className="siteSearch siteSearchMobile">
                        <Search className="siteSearchIcon"/>
                        <input
                            type="search"
                            placeholder="Search models…"
                            disabled
                            aria-label="Search (coming soon)"
                            title="Search is coming in a future update"
                        />
                    </label>
                </div>
            )}
        </header>
    );
}
