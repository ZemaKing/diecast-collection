// axe-core on key pages, both themes (ROADMAP Phase 35, via @axe-core/playwright). The full
// 23-scenario × theme × viewport matrix stays in `npm run a11y:axe` (Phase 34); this keeps the
// main pages from regressing on every E2E run. Fails on any critical/serious violation.
import AxeBuilder from "@axe-core/playwright";

import {expect, test} from "./fixtures.ts";

const PAGES: {name: string; path: string | ((slug: string) => string)}[] = [
    {name: "collection", path: "/"},
    {name: "collection filtered", path: "/?category=racing&sort=year-desc"},
    {name: "details", path: (slug) => `/models/${slug}`},
    {name: "brands", path: "/brands"},
    {name: "statistics", path: "/statistics"},
    {name: "login", path: "/login"},
    {name: "404", path: "/no-such-page-e2e"},
];

for (const theme of ["dark", "light"] as const) {
    for (const {name, path} of PAGES) {
        test(`axe: ${name} (${theme})`, async ({page, collection}) => {
            await page.emulateMedia({colorScheme: theme});
            await page.addInitScript((value) => {
                try { localStorage.setItem("zk-theme", value); } catch { /* storage blocked */ }
            }, theme);
            await page.goto(typeof path === "string" ? path : path(collection.models[0]!.slug));
            await expect(page.locator("h1")).toBeVisible();
            await expect(page.locator(".skeleton, [aria-busy='true'], .pageLoading")).toHaveCount(0);

            const results = await new AxeBuilder({page})
                .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
                .analyze();
            const failing = results.violations
                .filter((v) => v.impact === "critical" || v.impact === "serious")
                .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
            expect(failing).toEqual([]);
        });
    }
}
