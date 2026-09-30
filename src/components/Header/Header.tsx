import {useEffect, useId, useRef, useState} from "react";
import {Link, NavLink, useLocation, useNavigate, useSearchParams} from "react-router-dom";

import {Close} from "../../icons/Close.tsx";
import {Email} from "../../icons/Email.tsx";
import {Instagram} from "../../icons/Instagram.tsx";
import {Menu} from "../../icons/Menu.tsx";
import {Search} from "../../icons/Search.tsx";
import {MEDIA} from "../../styles/breakpoints.ts";
import {getSearchQueryFromSearchParams, withSearchQuery} from "../../utils/url-params.ts";
import {ThemeToggle} from "../ThemeToggle/ThemeToggle.tsx";

import "./Header.css";

type Props = {
    count: number;
};

// Only routes that actually resolve to a real page today — Statistics/Login land in Phases 23-24,
// and adding a nav link before then would violate "nav only links to pages that exist" (ROADMAP
// Phase 12). Manufacturers and Brands arrived in Phase 22 (the mockup's nav has only
// Manufacturers; Brands sits next to it as its twin).
// `section`: other paths that belong to the same nav item — a model page (Phase 19) is part of the
// Collection, so it stays highlighted there (without claiming aria-current="page").
const NAV_LINKS = [
    {to: "/", label: "Collection", end: true, section: "/models/"},
    {to: "/manufacturers", label: "Manufacturers", end: false, section: null},
    {to: "/brands", label: "Brands", end: false, section: null},
    {to: "/about", label: "About", end: false, section: null},
];

const SEARCH_DEBOUNCE_MS = 250;

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
    const searchId = useId();

    const closeMenu = () => setIsMenuOpen(false);

    // Global search (ROADMAP Phase 15): Header renders on every page, so the box always writes to
    // "/"'s ?q= — updating in place when already there, navigating there otherwise. `raw` is a
    // deliberate exception to "no local state" (Phase 13's URL-only rule): a debounced input needs
    // somewhere to hold the in-progress keystroke before it's worth committing to the URL/history.
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [raw, setRaw] = useState(() => getSearchQueryFromSearchParams(searchParams));
    const inSection = (section: string | null) => !!section && location.pathname.startsWith(section);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            if (location.pathname === "/") {
                setSearchParams((current) => withSearchQuery(current, raw), {replace: true});
            } else if (raw.trim()) {
                navigate(`/?q=${encodeURIComponent(raw.trim())}`);
            }
            // else: not on "/" and nothing typed — nothing to do, don't navigate for an empty box.
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timeoutId);
        // Only `raw` re-arms the debounce; re-running on every location/searchParams change would
        // fight the user's typing (see Phase 15 notes in ROADMAP.md for why this is a deliberate
        // exception to "no sync effects", not the pattern the rest of the query state follows).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [raw]);

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

    const searchInputProps = {
        type: "search" as const,
        placeholder: "Search models…",
        value: raw,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRaw(e.target.value),
        "aria-label": "Search models",
    };

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
                    {NAV_LINKS.map(({to, label, end, section}) => (
                        <NavLink key={to} to={to} end={end} className={({isActive}) => navLinkClass({isActive: isActive || inSection(section)})}>
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <label className="siteSearch" htmlFor={searchId}>
                    <Search className="siteSearchIcon"/>
                    <input id={searchId} {...searchInputProps}/>
                    {raw && (
                        <button type="button" className="siteSearchClear" onClick={() => setRaw("")} aria-label="Clear search">
                            <Close width={12} height={12}/>
                        </button>
                    )}
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
                        {NAV_LINKS.map(({to, label, end, section}) => (
                            <NavLink key={to} to={to} end={end} onClick={closeMenu} className={({isActive}) => mobileNavLinkClass({isActive: isActive || inSection(section)})}>
                                {label}
                            </NavLink>
                        ))}
                    </nav>

                    <label className="siteSearch siteSearchMobile" htmlFor={`${searchId}-mobile`}>
                        <Search className="siteSearchIcon"/>
                        <input id={`${searchId}-mobile`} {...searchInputProps}/>
                        {raw && (
                            <button type="button" className="siteSearchClear" onClick={() => setRaw("")} aria-label="Clear search">
                                <Close width={12} height={12}/>
                            </button>
                        )}
                    </label>
                </div>
            )}
        </header>
    );
}
