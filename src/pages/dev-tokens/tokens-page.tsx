// Dev-only design-token reference (/dev/tokens). Lazy-loaded behind import.meta.env.DEV in
// App.tsx, so it is never part of the production bundle. Reads token names straight from
// styles.css, so it can't drift from the source.
import {useEffect, useState, type ReactNode} from "react";

import tokensCss from "../../styles/styles.css?raw";
import {BREAKPOINTS, breakpointFor} from "../../styles/breakpoints.ts";
import {ThemeToggle} from "../../components/ThemeToggle/ThemeToggle";
import {CategoryLabel} from "../../components/CategoryLabel/CategoryLabel";
import {contrastRatio} from "../../utils/contrast.ts";
import "./tokens-page.css";

const ALL_TOKENS = [...new Set([...tokensCss.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]))];

const LEGACY = new Set(["--bg", "--panel", "--panel2", "--panel-alt", "--panel-alt-hover", "--modal-bg", "--text",
    "--muted", "--border", "--border-soft", "--overlay", "--pill-accent", "--pill-accent-hover-bg", "--surface-1",
    "--surface-2", "--surface-3", "--input-bg", "--accent"]);

// Tokens that are backgrounds/lines, not text — a contrast ratio against the page is meaningless.
const NON_TEXT = /bg|surface|border|overlay|scrim|soft|inverse|on-accent|subtle|^--color-accent(-hover|-active)?$/;

const byPrefix =(...prefixes: string[]) =>
    ALL_TOKENS.filter((t) => !LEGACY.has(t) && prefixes.some((p) => t.startsWith(p)));

function readTokens() {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
        theme: root.dataset.theme ?? "dark",
        values: Object.fromEntries(ALL_TOKENS.map((t) => [t, style.getPropertyValue(t).trim()])) as Record<string, string>,
    };
}

// Re-reads computed values whenever the theme toggle flips data-theme on <html>.
function useTokenValues() {
    const [state, setState] = useState(readTokens);
    useEffect(() => {
        const observer = new MutationObserver(() => setState(readTokens()));
        observer.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});
        return () => observer.disconnect();
    }, []);
    return state;
}

function useWidth() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const onResize = () => setWidth(window.innerWidth);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);
    return width;
}

function Contrast({fg, bg}: {fg: string; bg: string}) {
    if (!/^#[0-9a-f]{3,6}$/i.test(fg) || !/^#[0-9a-f]{3,6}$/i.test(bg)) return null;
    const ratio = contrastRatio(fg, bg);
    return <span className={ratio >= 4.5 ? "tkPass" : "tkFail"}>{ratio.toFixed(2)}:1</span>;
}

function Section({title, children}: {title: string; children: ReactNode}) {
    return (
        <section className="tkSection">
            <h2 className="tkSectionTitle">{title}</h2>
            {children}
        </section>
    );
}

export default function TokensPage() {
    const {theme: themeKey, values} = useTokenValues();
    const width = useWidth();
    const bg = values["--color-bg"];

    return (
        <div className="tkPage">
            <header className="tkHeader">
                <div>
                    <p className="tkEyebrow">Dev only</p>
                    <h1 className="tkTitle">Design tokens</h1>
                    <p className="tkMeta">
                        {ALL_TOKENS.length} tokens from <code>src/styles/styles.css</code> · theme <b>{themeKey}</b> ·
                        viewport {width}px = <b>{breakpointFor(width)}</b>
                    </p>
                </div>
                <ThemeToggle/>
            </header>

            <Section title="Color — surfaces, text, accent, feedback (contrast vs --color-bg)">
                <div className="tkGrid">
                    {byPrefix("--color-").map((t) => (
                        <div key={t} className="tkSwatch">
                            <div className="tkChip" style={{background: `var(${t})`}}/>
                            <code>{t}</code>
                            <span className="tkValue">
                                {values[t]} {!NON_TEXT.test(t) && <Contrast fg={values[t]} bg={bg}/>}
                            </span>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="Category (by slug)">
                <div className="tkRow">
                    {byPrefix("--cat-").map((t) => (
                        <div key={t} className="tkCat">
                            <CategoryLabel category={t.replace("--cat-", "").replace(/^\w/, (c) => c.toUpperCase())}/>
                            <code>{t}</code>
                            <span className="tkValue">{values[t]} <Contrast fg={values[t]} bg={bg}/></span>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="States">
                <div className="tkRow">
                    <button type="button" className="tkButton">Default</button>
                    <button type="button" className="tkButton tkButton--hover">Hover</button>
                    <button type="button" className="tkButton tkButton--active">Active</button>
                    <button type="button" className="tkButton tkButton--selected">Selected</button>
                    <button type="button" className="tkButton tkButton--focus">Focus ring</button>
                    <button type="button" className="tkButton" disabled>Disabled</button>
                    <button type="button" className="tkButton tkButton--primary">Primary (gold)</button>
                </div>
            </Section>

            <Section title="Typography">
                <p className="tkEyebrowSample">My collection</p>
                {byPrefix("--text-").map((t) => (
                    <div key={t} className="tkTypeRow">
                        <code>{t} · {values[t]}</code>
                        <span style={{fontSize: `var(${t})`}}>Chevrolet Corvette Stingray</span>
                    </div>
                ))}
                <div className="tkRow">
                    {byPrefix("--weight-").map((t) => (
                        <span key={t} style={{fontWeight: `var(${t})`}}>{t.replace("--weight-", "")}</span>
                    ))}
                </div>
            </Section>

            <Section title="Spacing">
                {byPrefix("--space-").map((t) => (
                    <div key={t} className="tkBarRow">
                        <code>{t} · {values[t]}</code>
                        <div className="tkBar" style={{width: `var(${t})`}}/>
                    </div>
                ))}
            </Section>

            <Section title="Radius & elevation">
                <div className="tkRow">
                    {byPrefix("--radius-").map((t) => (
                        <div key={t} className="tkBox" style={{borderRadius: `var(${t})`}}><code>{t}</code></div>
                    ))}
                </div>
                <div className="tkRow">
                    {byPrefix("--shadow-").filter((t) => t !== "--shadow-color").map((t) => (
                        <div key={t} className="tkBox" style={{boxShadow: `var(${t})`}}><code>{t}</code></div>
                    ))}
                </div>
            </Section>

            <Section title="Motion, z-index, layout, breakpoints">
                <table className="tkTable">
                    <tbody>
                    {byPrefix("--duration-", "--ease-", "--z-", "--container-", "--header-", "--tap-", "--border-width", "--leading-", "--tracking-", "--font-").map((t) => (
                        <tr key={t}><td><code>{t}</code></td><td>{values[t]}</td></tr>
                    ))}
                    {Object.entries(BREAKPOINTS).map(([name, px]) => (
                        <tr key={name}><td><code>breakpoint {name}</code></td><td>≥ {px}px</td></tr>
                    ))}
                    </tbody>
                </table>
            </Section>
        </div>
    );
}
