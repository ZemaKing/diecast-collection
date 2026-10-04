// Headless Edge/Chrome over the DevTools protocol, with no dependencies (Node's built-in WebSocket).
// Shared by scripts/perf/vitals.mjs (Phase 33) and scripts/a11y/axe.mjs (Phase 34).
import {spawn} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BROWSER_CANDIDATES = [
    process.env.PERF_BROWSER,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/microsoft-edge",
].filter(Boolean);

function findBrowser() {
    const found = BROWSER_CANDIDATES.find((p) => fs.existsSync(p));
    if (!found) throw new Error("No Edge/Chrome found — set PERF_BROWSER to a Chromium executable.");
    return found;
}

export async function launchBrowser() {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "zk-perf-"));
    const proc = spawn(findBrowser(), [
        "--headless=new",
        "--remote-debugging-port=0",
        `--user-data-dir=${userDataDir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-sync",
        "about:blank",
    ], {stdio: "ignore"});

    const portFile = path.join(userDataDir, "DevToolsActivePort");
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(100);
    const [port, wsPath] = fs.readFileSync(portFile, "utf8").trim().split("\n");
    const cdp = await connect(`ws://127.0.0.1:${port}${wsPath}`);

    return {
        cdp,
        async close() {
            try { await cdp.send("Browser.close"); } catch { /* already gone */ }
            cdp.ws.close();
            await new Promise((resolve) => (proc.exitCode !== null ? resolve() : proc.once("exit", resolve)));
            fs.rmSync(userDataDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
        },
    };
}

export function connect(url) {
    const ws = new WebSocket(url);
    let nextId = 1;
    const pending = new Map();
    const listeners = new Set();
    ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
            const {resolve, reject} = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
            else resolve(msg.result);
        } else if (msg.method) {
            for (const fn of listeners) fn(msg);
        }
    });
    const cdp = {
        ws,
        send(method, params = {}, sessionId) {
            const id = nextId++;
            ws.send(JSON.stringify({id, method, params, sessionId}));
            return new Promise((resolve, reject) => pending.set(id, {resolve, reject}));
        },
        on(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
    return new Promise((resolve, reject) => {
        ws.addEventListener("open", () => resolve(cdp), {once: true});
        ws.addEventListener("error", reject, {once: true});
    });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
