// End-to-end tests (ROADMAP Phase 35) — `npm run test:e2e`. See e2e/README.md.
//
// The suite is READ-ONLY by the owner's decision: it runs the production build against the
// Supabase project in `.env.local` (the live data) and never writes. e2e/fixtures.ts fails any
// test whose page sends a non-GET request to Supabase, so a future write test can't slip in.
//
// Browsers: the locally installed Microsoft Edge (`channel: "msedge"`, like scripts/lib/headless.mjs)
// — no Playwright browser download needed. Override with E2E_CHANNEL=chrome.
//
// E2E_BASE_URL=https://… runs the same read-only suite against a deployed site (a Vercel preview
// or production, Phase 37) instead of a local build. The site must use the same Supabase project as
// .env.local, since expected values are read from it.
import {defineConfig, devices} from "@playwright/test";

const PORT = 4174; // not 4173, so a hand-started `npm run preview` of an older build is never reused
const channel = process.env.E2E_CHANNEL ?? "msedge";
const deployedUrl = process.env.E2E_BASE_URL?.trim().replace(/\/+$/, "");

export default defineConfig({
    testDir: "e2e",
    outputDir: "test-results/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    // No retries: a flaky test should show up as flaky, not be hidden. Every failure keeps a trace.
    retries: 0,
    workers: process.env.CI ? 2 : 4,
    timeout: 45_000,
    expect: {timeout: 15_000},
    reporter: [["list"], ["html", {outputFolder: "playwright-report", open: "never"}]],
    use: {
        baseURL: deployedUrl ?? `http://localhost:${PORT}`,
        channel,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        // Deterministic: no animation timing, dark theme unless a test says otherwise.
        reducedMotion: "reduce",
        colorScheme: "dark",
    },
    projects: [
        {name: "desktop", use: {...devices["Desktop Chrome"], channel, viewport: {width: 1280, height: 900}}, testIgnore: /mobile\.spec\.ts/},
        {name: "mobile", use: {...devices["Pixel 7"], channel}, testMatch: /mobile\.spec\.ts/},
    ],
    webServer: deployedUrl ? undefined : {
        // Always a fresh production build (postbuild secret scan included) — what visitors get.
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: "ignore",
        stderr: "pipe",
    },
});
