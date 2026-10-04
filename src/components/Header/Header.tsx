import {useEffect, useId, useRef, useState} from "react";
import {Link, NavLink, useLocation, useNavigate, useSearchParams} from "react-router-dom";

import {Close} from "../../icons/Close.tsx";
import {Email} from "../../icons/Email.tsx";
import {Instagram} from "../../icons/Instagram.tsx";
import {Menu} from "../../icons/Menu.tsx";
import {Search} from "../../icons/Search.tsx";
import {useFocusOnNavigation} from "../../hooks/useFocusOnNavigation.ts";
import {useModelCount} from "../../hooks/useModelCount.ts";
import {MEDIA} from "../../styles/breakpoints.ts";
import {MAIN_CONTENT_ID} from "../../utils/a11y.ts";
import {getSearchQueryFromSearchParams, withSearchQuery} from "../../utils/url-params.ts";
import {ThemeToggle} from "../ThemeToggle/ThemeToggle.tsx";
import {AccountMenu} from "./AccountMenu.tsx";

import "./Header.css";

// Only routes that actually resolve to a real page today — Login lands in Phase 24, and adding a
// nav link before then would violate "nav only links to pages that exist" (ROADMAP Phase 12).
// Manufacturers and Brands arrived in Phase 22 (the mockup's nav has only Manufacturers; Brands
// sits next to it as its twin), Statistics in Phase 23.
// `section`: other paths that belong to the same nav item — a model page (Phase 19) is part of the
// Collection, so it stays highlighted there (without claiming aria-current="page").
const NAV_LINKS = [
    {to: "/", label: "Collection", end: true, section: "/models/"},
    {to: "/manufacturers", label: "Manufacturers", end: false, section: null},
    {to: "/brands", label: "Brands", end: false, section: null},
    {to: "/statistics", label: "Statistics", end: false, section: null},
    {to: "/about", label: "About", end: false, section: null},
];

const SEARCH_DEBOUNCE_MS = 250;

// Router state on the navigation the search box makes from another page to "/?q=": the new page's
// header puts focus back in the box, so typing carries on (each page renders its own Header).
type HeaderLocationState = {focusSearch?: boolean} | null;

// "Skip to content" (Phase 34): moves focus to the page's <main id="main-content" tabIndex={-1}>.
// Handled here rather than as a plain #hash link, which would add a history entry the router sees.
function skipToContent(e: React.MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (!main) return;
    e.preventDefault();
    main.focus();
}

function navLinkClass({isActive}: {isActive: boolean}) {
    return `siteNavLink${isActive ? " siteNavLinkActive" : ""}`;
}

function mobileNavLinkClass({isActive}: {isActive: boolean}) {
    return `mobileNavLink${isActive ? " mobileNavLinkActive" : ""}`;
}

export function Header() {
    // "N models": read here (one cache shared by every page), hidden until the list has loaded —
    // never "0 models" while it loads or failed (Phase 30).
    const count = useModelCount();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const drawerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
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
    const urlQuery = getSearchQueryFromSearchParams(searchParams);
    const [raw, setRaw] = useState(urlQuery);
    // What this box last wrote to ?q= — so an outside change (Back/Forward, the collection's
    // "Clear search", Phase 29) can be told apart from the box's own debounced write, which the
    // typing may already have moved past. Adjusted during render, React's pattern for "state that
    // follows a changing input" — no sync effect.
    const [writtenQuery, setWrittenQuery] = useState(urlQuery);
    const [seenQuery, setSeenQuery] = useState(urlQuery);
    if (urlQuery !== seenQuery) {
        setSeenQuery(urlQuery);
        if (urlQuery !== writtenQuery) {
            setWrittenQuery(urlQuery);
            setRaw(urlQuery);
        }
    }
    const inSection = (section: string | null) => !!section && location.pathname.startsWith(section);

    // Declared before useFocusOnNavigation, which then sees focus already placed and leaves it.
    const focusSearch = (location.state as HeaderLocationState)?.focusSearch === true;
    useEffect(() => {
        if (!focusSearch) return;
        const input = searchInputRef.current;
        input?.focus({preventScroll: true});
        input?.setSelectionRange(input.value.length, input.value.length);
    }, [focusSearch]);
    useFocusOnNavigation();

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            if (location.pathname === "/") {
                setWrittenQuery(raw.trim() ? raw : "");
                setSearchParams((current) => withSearchQuery(current, raw), {replace: true});
            } else if (raw.trim()) {
                navigate(`/?q=${encodeURIComponent(raw.trim())}`, {state: {focusSearch: true} satisfies HeaderLocationState});
            }
            // else: not on "/" and nothing typed — nothing to do, don't navigate for an empty box.
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timeoutId);
        // Only `raw` re-arms the debounce; re-running on every location/searchParams change would
        // fight the user's typing (see Phase 15 notes in ROADMAP.md for why this is a deliberate
        // exception to "no sync effects", not the pattern the rest of the query state follows).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [raw]);

    // The drawer is a disclosure (like AccountMenu), not a modal: the page below stays live. Opening
    // it moves focus to its first link; Escape closes it and returns focus to ☰; a click outside
    // it, or Tab moving focus out of it, just closes it (Phase 34).
    useEffect(() => {
        if (!isMenuOpen) return;

        drawerRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
        const inMenu = (node: EventTarget | null) =>
            node instanceof Node && (!!drawerRef.current?.contains(node) || !!menuButtonRef.current?.contains(node));

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setIsMenuOpen(false);
            menuButtonRef.current?.focus();
        };
        const onPointerDown = (e: PointerEvent) => {
            if (!inMenu(e.target)) setIsMenuOpen(false);
        };
        const onFocusIn = (e: FocusEvent) => {
            if (!inMenu(e.target)) setIsMenuOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("focusin", onFocusIn);

        // The drawer is phone-only content (Phase 31: tablet shows the nav inline); if a resize (or
        // rotation) crosses into tablet, the inline nav takes over and a stuck-open drawer would double up.
        const tabletUp = window.matchMedia(MEDIA.tabletUp);
        const onTabletUp = (e: MediaQueryListEvent) => {
            if (e.matches) setIsMenuOpen(false);
        };
        tabletUp.addEventListener("change", onTabletUp);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("focusin", onFocusIn);
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
            <a className="skipLink" href={`#${MAIN_CONTENT_ID}`} onClick={skipToContent}>Skip to content</a>
            <div className="siteHeaderInner">
                {/* Phone only, first in the row as in the mobile mockup (Phase 32). */}
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
                    <input ref={searchInputRef} id={searchId} {...searchInputProps}/>
                    {raw && (
                        <button type="button" className="siteSearchClear" onClick={() => setRaw("")} aria-label="Clear search">
                            <Close width={12} height={12}/>
                        </button>
                    )}
                </label>

                <div className="siteHeaderActions">
                    {count !== null && <span className="modelCountPill">{count} models</span>}
                    <AccountMenu/>
                    <ThemeToggle/>
                    {/* Below 640px they move into the drawer: with the signed-in avatar the row
                        otherwise pushed the count off a 360px screen. */}
                    <span className="headerSocial">
                        <SocialLinks/>
                    </span>
                </div>
            </div>

            {isMenuOpen && (
                <div ref={drawerRef} id={drawerId} className="mobileDrawer">
                    <nav className="mobileNav" aria-label="Primary">
                        {NAV_LINKS.map(({to, label, end, section}) => (
                            <NavLink key={to} to={to} end={end} onClick={closeMenu} className={({isActive}) => mobileNavLinkClass({isActive: isActive || inSection(section)})}>
                                {label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="mobileSocial">
                        <SocialLinks/>
                    </div>
                </div>
            )}
        </header>
    );
}

function SocialLinks() {
    return (
        <>
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
        </>
    );
}
