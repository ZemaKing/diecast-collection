// Lab Web Vitals for the production build (ROADMAP Phase 33). No dependencies: it launches a
// locally installed Chromium browser (Edge or Chrome) headless and drives it over the DevTools
// protocol with Node's built-in WebSocket.
//
//   npm run build && npm run preview          (another terminal — serves dist/ on :4173)
//   npm run perf:vitals                       (all routes, both profiles, 5 runs each)
//   npm run perf:vitals -- --runs 3 --profile mobile --route /statistics --json out.json
//   npm run perf:vitals -- --runs 1 --profile mobile --route / --waterfall   (request timeline)
//
// Every run is a fresh incognito context (cold HTTP cache, no service worker, no sign-in), so it
// measures a first visit. "mobile" ≈ Lighthouse's mobile preset (Moto G Power-ish viewport, 4× CPU
// slowdown, "Slow 4G" 150 ms RTT / 1.6 Mbps); "desktop" ≈ its desktop preset (no CPU slowdown,
// 40 ms / 10 Mbps). Throttling is DevTools-applied (not Lighthouse's simulation), so numbers are
// comparable run to run on one machine, not with PageSpeed Insights. Supabase is the real project
// over the real internet: expect some variance — that's why it reports medians.
import fs from "node:fs";

import {launchBrowser, sleep} from "../lib/headless.mjs";

const PROFILES = {
    mobile: {
        viewport: {width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true},
        cpu: 4,
        network: {latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8},
    },
    desktop: {
        viewport: {width: 1350, height: 940, deviceScaleFactor: 1, mobile: false},
        cpu: 1,
        network: {latency: 40, downloadThroughput: (10 * 1024 * 1024) / 8, uploadThroughput: (10 * 1024 * 1024) / 8},
    },
};

// A model with a photo, so the details page measures a real LCP image.
const DEFAULT_ROUTES = ["/", "/models/porsche-911-gt3-rs-2003-altaya-white", "/brands", "/statistics"];

function parseArgs(argv) {
    const args = {base: "http://localhost:4173", runs: 5, profiles: [], routes: [], json: null, waterfall: false};
    for (let i = 0; i < argv.length; i++) {
        const [flag, value] = [argv[i], argv[i + 1]];
        if (flag === "--base") args.base = value, i++;
        else if (flag === "--runs") args.runs = Number(value), i++;
        else if (flag === "--profile") args.profiles.push(value), i++;
        else if (flag === "--route") args.routes.push(value), i++;
        else if (flag === "--json") args.json = value, i++;
        else if (flag === "--waterfall") args.waterfall = true;
        else throw new Error(`Unknown argument ${flag}`);
    }
    if (args.profiles.length === 0) args.profiles = Object.keys(PROFILES);
    if (args.routes.length === 0) args.routes = DEFAULT_ROUTES;
    for (const p of args.profiles) if (!PROFILES[p]) throw new Error(`Unknown profile ${p}`);
    return args;
}

// Recorded in the page from its first byte — LCP, CLS (session windows, as web-vitals does), FCP
// and long tasks (for an approximate Total Blocking Time).
const OBSERVER_SCRIPT = `(() => {
  const v = window.__vitals = {lcp: 0, lcpElement: null, cls: 0, fcp: 0, longTasks: []};
  let win = 0, winStart = 0, winLast = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) {
    v.lcp = e.startTime;
    const el = e.element;
    v.lcpElement = el ? (el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "") + (e.url ? " " + e.url.split("/").pop().slice(0, 40) : "")) : null;
  } }).observe({type: "largest-contentful-paint", buffered: true});
  new PerformanceObserver((l) => { for (const e of l.getEntries()) {
    if (e.hadRecentInput) continue;
    if (win && e.startTime - winLast < 1000 && e.startTime - winStart < 5000) { win += e.value; winLast = e.startTime; }
    else { win = e.value; winStart = winLast = e.startTime; }
    v.cls = Math.max(v.cls, win);
  } }).observe({type: "layout-shift", buffered: true});
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") v.fcp = e.startTime; })
    .observe({type: "paint", buffered: true});
  new PerformanceObserver((l) => { for (const e of l.getEntries()) v.longTasks.push([e.startTime, e.duration]); })
    .observe({type: "longtask", buffered: true});
})();`;

async function measure(cdp, url, profile) {
    const {browserContextId} = await cdp.send("Target.createBrowserContext", {disposeOnDetach: true});
    const {targetId} = await cdp.send("Target.createTarget", {url: "about:blank", browserContextId});
    const {sessionId} = await cdp.send("Target.attachToTarget", {targetId, flatten: true});
    const send = (method, params) => cdp.send(method, params, sessionId);

    const requests = new Map();
    let inFlight = 0;
    let lastNetworkActivity = Date.now();
    let loaded = false;
    const off = cdp.on((msg) => {
        if (msg.sessionId !== sessionId) return;
        const p = msg.params;
        switch (msg.method) {
            case "Network.requestWillBeSent":
                if (!requests.has(p.requestId)) inFlight++;
                requests.set(p.requestId, {url: p.request.url, method: p.request.method, type: p.type ?? "Other", bytes: 0, start: p.timestamp, end: null, status: null});
                lastNetworkActivity = Date.now();
                break;
            case "Network.responseReceived": {
                const r = requests.get(p.requestId);
                if (r) Object.assign(r, {type: p.type ?? r.type, status: p.response.status, decoded: 0});
                break;
            }
            case "Network.dataReceived": {
                const r = requests.get(p.requestId);
                if (r) r.decoded = (r.decoded ?? 0) + p.dataLength;
                break;
            }
            case "Network.loadingFinished":
            case "Network.loadingFailed": {
                const r = requests.get(p.requestId);
                if (r && r.end === null) {
                    r.end = p.timestamp;
                    r.bytes = p.encodedDataLength ?? 0;
                    r.failed = msg.method === "Network.loadingFailed";
                    inFlight--;
                }
                lastNetworkActivity = Date.now();
                break;
            }
            case "Page.loadEventFired":
                loaded = true;
                break;
        }
    });

    await send("Page.enable");
    await send("Network.enable");
    await send("Network.setCacheDisabled", {cacheDisabled: true});
    await send("Network.emulateNetworkConditions", {offline: false, ...profile.network});
    await send("Emulation.setCPUThrottlingRate", {rate: profile.cpu});
    await send("Emulation.setDeviceMetricsOverride", profile.viewport);
    await send("Page.addScriptToEvaluateOnNewDocument", {source: OBSERVER_SCRIPT});

    await send("Page.navigate", {url});
    const deadline = Date.now() + 45_000;
    // Settled = loaded and 2 s with nothing on the wire (the summary fetch and the first row of
    // lazy thumbnails come after `load`).
    while (Date.now() < deadline && !(loaded && inFlight <= 0 && Date.now() - lastNetworkActivity > 2000)) await sleep(100);

    const {result} = await send("Runtime.evaluate", {
        expression: `JSON.stringify({...window.__vitals, nav: performance.getEntriesByType("navigation")[0]?.toJSON()})`,
        returnByValue: true,
    });
    off();
    await cdp.send("Target.disposeBrowserContext", {browserContextId});

    const page = JSON.parse(result.value);
    const tbt = page.longTasks
        .filter(([start]) => start >= page.fcp)
        .reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0);

    const byType = {};
    for (const r of requests.values()) {
        const key = /model_summaries/.test(r.url) ? "summaries" : r.type;
        byType[key] ??= {count: 0, bytes: 0};
        byType[key].count++;
        byType[key].bytes += r.bytes;
    }
    const summaries = [...requests.values()].find((r) => /model_summaries/.test(r.url) && r.method === "GET" && r.status === 200);

    return {
        fcp: page.fcp,
        lcp: page.lcp,
        lcpElement: page.lcpElement,
        cls: page.cls,
        tbt,
        domContentLoaded: page.nav?.domContentLoadedEventEnd ?? null,
        requests: requests.size,
        transferBytes: [...requests.values()].reduce((s, r) => s + r.bytes, 0),
        byType,
        summaries: summaries ? {transfer: summaries.bytes, decoded: summaries.decoded, ms: (summaries.end - summaries.start) * 1000} : null,
        timedOut: Date.now() >= deadline,
        waterfall: waterfall(requests),
        longTasks: page.longTasks,
    };
}

// Request timeline relative to the document request, for --waterfall.
function waterfall(requests) {
    const all = [...requests.values()];
    const t0 = Math.min(...all.map((r) => r.start));
    return all
        .sort((a, b) => a.start - b.start)
        .map((r) => ({
            start: (r.start - t0) * 1000,
            end: r.end === null ? null : (r.end - t0) * 1000,
            method: r.method,
            type: r.type,
            status: r.status,
            bytes: r.bytes,
            url: r.url.replace(/^https?:\/\/[^/]+/,(origin) => (origin.includes("supabase") ? "[supabase]" : origin.includes("localhost") ? "" : origin)).slice(0, 90),
        }));
}

const median = (xs) => {
    const s = xs.filter((x) => x != null).sort((a, b) => a - b);
    if (s.length === 0) return null;
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const kb = (bytes) => (bytes == null ? "—" : `${(bytes / 1024).toFixed(1)} kB`);
const ms = (x) => (x == null ? "—" : `${Math.round(x)} ms`);

async function main() {
    const args = parseArgs(process.argv.slice(2));
    try {
        const res = await fetch(args.base);
        if (!res.ok) throw new Error(String(res.status));
    } catch {
        console.error(`Nothing is serving ${args.base} — run \`npm run build && npm run preview\` first.`);
        process.exit(1);
    }

    const browser = await launchBrowser();
    const report = [];
    try {
        // One throwaway load: wakes Supabase up and warms DNS/TLS outside the measured runs' caches
        // (each run is still a cold browser cache).
        await measure(browser.cdp, args.base + args.routes[0], PROFILES.desktop);

        for (const profileName of args.profiles) {
            for (const route of args.routes) {
                const runs = [];
                for (let i = 0; i < args.runs; i++) runs.push(await measure(browser.cdp, args.base + route, PROFILES[profileName]));
                const pick = (f) => median(runs.map(f));
                const row = {
                    profile: profileName,
                    route,
                    runs: runs.length,
                    fcp: pick((r) => r.fcp),
                    lcp: pick((r) => r.lcp),
                    cls: pick((r) => r.cls),
                    tbt: pick((r) => r.tbt),
                    requests: pick((r) => r.requests),
                    transferBytes: pick((r) => r.transferBytes),
                    scriptBytes: pick((r) => r.byType.Script?.bytes ?? 0),
                    cssBytes: pick((r) => r.byType.Stylesheet?.bytes ?? 0),
                    imageBytes: pick((r) => r.byType.Image?.bytes ?? 0),
                    imageCount: pick((r) => r.byType.Image?.count ?? 0),
                    summariesTransfer: pick((r) => r.summaries?.transfer),
                    summariesDecoded: pick((r) => r.summaries?.decoded),
                    summariesMs: pick((r) => r.summaries?.ms),
                    lcpElements: [...new Set(runs.map((r) => r.lcpElement))],
                    timedOut: runs.some((r) => r.timedOut),
                };
                report.push(row);
                if (args.waterfall) {
                    for (const r of runs[0].waterfall) {
                        console.log(`  ${ms(r.start).padStart(8)} → ${ms(r.end).padStart(8)}  ${(r.method ?? "").padEnd(7)} ${String(r.status ?? "").padEnd(4)} ${r.type.padEnd(11)} ${kb(r.bytes).padStart(9)}  ${r.url}`);
                    }
                    // Long tasks are on the page's clock (navigation start), close to the document request's.
                    console.log("  long tasks: " + (runs[0].longTasks.map(([start, duration]) => `${ms(start)} +${ms(duration)}`).join(", ") || "none"));
                }
                console.log(
                    `${profileName.padEnd(7)} ${route.padEnd(44)} FCP ${ms(row.fcp).padStart(8)}  LCP ${ms(row.lcp).padStart(8)}` +
                        `  CLS ${row.cls.toFixed(3)}  TBT ${ms(row.tbt).padStart(7)}  ${String(row.requests).padStart(3)} req` +
                        `  ${kb(row.transferBytes).padStart(9)} (JS ${kb(row.scriptBytes)}, CSS ${kb(row.cssBytes)}, img ${kb(row.imageBytes)} ×${row.imageCount})` +
                        (row.summariesTransfer != null ? `  summaries ${kb(row.summariesTransfer)} / ${kb(row.summariesDecoded)} raw, ${ms(row.summariesMs)}` : "") +
                        `\n        LCP element: ${row.lcpElements.join(" | ")}${row.timedOut ? "  (a run timed out)" : ""}`,
                );
            }
        }
    } finally {
        await browser.close();
    }

    if (args.json) fs.writeFileSync(args.json, JSON.stringify({date: new Date().toISOString(), base: args.base, report}, null, 2));
}

await main();
