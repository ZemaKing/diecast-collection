// axe-core accessibility audit of the running app in a real (headless) browser (ROADMAP Phase 34).
// jsdom can't compute colors or layout, so contrast and target-size checks need a real browser —
// this drives a locally installed Edge/Chrome over the DevTools protocol (scripts/lib/headless.mjs)
// and injects axe-core from node_modules.
//
//   npm run build && npm run preview          (another terminal — serves dist/ on :4173)
//   npm run a11y:axe                          (every scenario × dark/light × desktop/mobile)
//   npm run a11y:axe -- --base http://localhost:5173 --only details --theme light --viewport mobile
//   npm run a11y:axe -- --json out.json --all-impacts --incomplete   (minor/moderate + "needs review")
//
// Exits 1 when any critical/serious violation remains that isn't a documented exception
// (EXCEPTIONS below, mirrored in docs/accessibility.md). Admin pages need a signed-in owner, so
// they're not covered here (Phase 35 stayed read-only, so they still need a by-hand check).
import fs from "node:fs";
import {createRequire} from "node:module";

import {launchBrowser, sleep} from "../lib/headless.mjs";

const require = createRequire(import.meta.url);
const AXE_SOURCE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const VIEWPORTS = {
    desktop: {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false},
    mobile: {width: 375, height: 812, deviceScaleFactor: 2, mobile: true},
};

const DETAILS = "/models/porsche-911-gt3-rs-2003-altaya-white";

// Each scenario: a route, optional localStorage, and optional steps run in the page once it has
// settled (a step is a JS expression; it may return a promise). `viewports` limits where it runs.
const SCENARIOS = [
    {name: "collection", route: "/"},
    {name: "collection-list", route: "/", storage: {"zk-view-mode": "list"}},
    {name: "collection-compact", route: "/", storage: {"zk-view-mode": "compact"}},
    {name: "collection-filtered", route: "/?category=Racing&q=porsche&sort=year-desc"},
    {name: "collection-empty", route: "/?q=zzzzzz"},
    {name: "filter-dropdown", route: "/", viewports: ["desktop"], steps: [`document.querySelector(".toolbarTriggers .filterTrigger summary").click()`]},
    {name: "sort-dropdown", route: "/", steps: [`document.querySelector(".sortTrigger summary").click()`]},
    {name: "filter-sheet", route: "/", steps: [`document.querySelector(".filtersToggle").click()`]},
    {name: "quick-view", route: "/", viewports: ["desktop"], steps: [`document.querySelector(".quickViewTrigger").click()`], wait: "document.querySelector('dialog.quickView[open] .quickViewTitle, dialog[open] h2')"},
    {name: "mobile-drawer", route: "/", viewports: ["mobile"], steps: [`document.querySelector(".menuButton").click()`]},
    {name: "details", route: DETAILS},
    {name: "details-specs", route: `${DETAILS}?tab=specifications`},
    {name: "details-collection", route: `${DETAILS}?tab=collection`},
    {name: "lightbox", route: DETAILS, steps: [`document.querySelector(".galleryFullscreen").click()`]},
    {name: "brands", route: "/brands"},
    {name: "brand", route: "/brands/porsche"},
    {name: "manufacturers", route: "/manufacturers"},
    {name: "manufacturer", route: "/manufacturers/altaya"},
    {name: "statistics", route: "/statistics"},
    {name: "about", route: "/about"},
    {name: "login", route: "/login"},
    {name: "not-found", route: "/no-such-page"},
    {name: "model-not-found", route: "/models/no-such-model"},
];

// Documented, accepted exceptions (docs/accessibility.md § Exceptions): rule id → reason.
// Keep this list short and specific; everything else critical/serious fails the run.
const EXCEPTIONS = {};

const FAILING = new Set(["critical", "serious"]);

function parseArgs(argv) {
    const args = {base: "http://localhost:4173", only: [], themes: [], viewports: [], json: null, allImpacts: false, incomplete: false};
    for (let i = 0; i < argv.length; i++) {
        const [flag, value] = [argv[i], argv[i + 1]];
        if (flag === "--base") args.base = value, i++;
        else if (flag === "--only") args.only.push(value), i++;
        else if (flag === "--theme") args.themes.push(value), i++;
        else if (flag === "--viewport") args.viewports.push(value), i++;
        else if (flag === "--json") args.json = value, i++;
        else if (flag === "--all-impacts") args.allImpacts = true;
        else if (flag === "--incomplete") args.incomplete = true;
        else throw new Error(`Unknown argument ${flag}`);
    }
    if (args.themes.length === 0) args.themes = ["dark", "light"];
    if (args.viewports.length === 0) args.viewports = Object.keys(VIEWPORTS);
    for (const v of args.viewports) if (!VIEWPORTS[v]) throw new Error(`Unknown viewport ${v}`);
    for (const n of args.only) if (!SCENARIOS.some((s) => s.name === n)) throw new Error(`Unknown scenario ${n}`);
    return args;
}

async function audit(cdp, base, scenario, theme, viewport) {
    const {browserContextId} = await cdp.send("Target.createBrowserContext", {disposeOnDetach: true});
    const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank", browserContextId});
    const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
    const send = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async (expression) => {
        const {result, exceptionDetails} = await send("Runtime.evaluate", {expression, awaitPromise: true, returnByValue: true});
        if (exceptionDetails) throw new Error(`${scenario.name}: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
        return result.value;
    };
    const waitFor = async (expression, timeout = 20_000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            if (await evaluate(`Boolean(${expression})`)) return true;
            await sleep(100);
        }
        return false;
    };

    try {
        await send("Page.enable");
        await send("Emulation.setDeviceMetricsOverride", VIEWPORTS[viewport]);
        if (VIEWPORTS[viewport].mobile) await send("Emulation.setTouchEmulationEnabled", {enabled: true, maxTouchPoints: 5});
        await send("Emulation.setEmulatedMedia", {features: [{name: "prefers-color-scheme", value: theme}, {name: "prefers-reduced-motion", value: "reduce"}]});
        const storage = {"zk-theme": theme, ...scenario.storage};
        await send("Page.addScriptToEvaluateOnNewDocument", {
            source: `try { ${Object.entries(storage).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join(" ")} } catch {}`,
        });

        await send("Page.navigate", {url: base + scenario.route});
        // Settled = a heading rendered and no skeleton/loading region left.
        const settled = await waitFor(`document.readyState === "complete" && document.querySelector("h1, h2") && !document.querySelector(".skeleton, [aria-busy='true'], .pageLoading")`);
        await sleep(300);
        for (const step of scenario.steps ?? []) {
            await evaluate(step);
            await sleep(400);
        }
        if (scenario.wait) await waitFor(scenario.wait);
        await sleep(200);

        await evaluate(AXE_SOURCE);
        // target-size (WCAG 2.2 AA, 24×24 px) is opt-in in axe; the app aims for it.
        const results = await evaluate(`axe.run(document, {rules: {"target-size": {enabled: true}}}).then((r) => {
            const map = (list) => list.map((v) => ({
                id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
                nodes: v.nodes.map((n) => ({target: n.target.join(" "), summary: n.failureSummary ?? "", html: n.html.slice(0, 160)})),
            }));
            return {violations: map(r.violations), incomplete: map(r.incomplete), passes: r.passes.length, elements: document.querySelectorAll("*").length};
        })`);
        return {settled, ...results};
    } finally {
        await cdp.send("Target.disposeBrowserContext", {browserContextId});
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    try {
        const res = await fetch(args.base);
        if (!res.ok) throw new Error(String(res.status));
    } catch {
        console.error(`Nothing is serving ${args.base} — run \`npm run build && npm run preview\` first.`);
        process.exit(1);
    }

    const scenarios = args.only.length ? SCENARIOS.filter((s) => args.only.includes(s.name)) : SCENARIOS;
    const browser = await launchBrowser();
    const report = [];
    let failures = 0;
    try {
        for (const viewport of args.viewports) {
            for (const theme of args.themes) {
                for (const scenario of scenarios) {
                    if (scenario.viewports && !scenario.viewports.includes(viewport)) continue;
                    const {settled, violations, incomplete, passes, elements} = await audit(browser.cdp, args.base, scenario, theme, viewport);
                    const shown = violations.filter((v) => args.allImpacts || FAILING.has(v.impact));
                    const failing = violations.filter((v) => FAILING.has(v.impact) && !EXCEPTIONS[v.id]);
                    failures += failing.length;
                    report.push({scenario: scenario.name, route: scenario.route, theme, viewport, settled, elements, passes, violations, incomplete});
                    const label = `${viewport.padEnd(7)} ${theme.padEnd(5)} ${scenario.name}`;
                    console.log(`${failing.length ? "✗" : "✓"} ${label}  (${elements} elements, ${passes} rules passed)${settled ? "" : "  (didn't settle — audited anyway)"}`);
                    for (const v of shown) {
                        const note = EXCEPTIONS[v.id] ? `  [exception: ${EXCEPTIONS[v.id]}]` : "";
                        console.log(`    ${v.impact.padEnd(8)} ${v.id} — ${v.help} (${v.nodes.length})${note}`);
                        for (const n of v.nodes.slice(0, 4)) console.log(`             ${n.target}\n               ${n.summary.split("\n").slice(1).join(" ").slice(0, 220)}`);
                    }
                }
            }
        }
    } finally {
        await browser.close();
    }

    if (args.json) fs.writeFileSync(args.json, JSON.stringify({date: new Date().toISOString(), base: args.base, report}, null, 2));
    console.log(failures ? `\n${failures} critical/serious violation(s).` : "\nNo critical/serious violations.");
    process.exitCode = failures ? 1 : 0;
}

await main();
