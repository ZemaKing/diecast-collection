// Shared Playwright fixtures for the end-to-end suite (ROADMAP Phase 35).
//
// Every test gets two automatic guards:
//   - read-only: any non-GET/HEAD request from the page to Supabase is aborted and fails the test
//     (the suite runs against the live project — the owner chose read-only journeys over a
//     separate test project, so nothing here may ever write);
//   - no uncaught page errors (React render crashes, failed lazy chunks, …).
// And `collection`: the published models, fetched straight from the REST API with the anon key —
// an oracle independent of the app's own filter/sort code, so expected counts follow the live data
// instead of being hard-coded (adding a car never breaks the suite).
import {test as base, expect, type Page} from "@playwright/test";

import {fetchCollection, supabaseOrigin, type Collection} from "./support/data.ts";

type Fixtures = {
    guards: void;
};
type WorkerFixtures = {
    collection: Collection;
};

export const test = base.extend<Fixtures, WorkerFixtures>({
    // eslint-disable-next-line no-empty-pattern -- Playwright reads the fixture deps from this destructuring
    collection: [async ({}, use) => {
        await use(await fetchCollection());
    }, {scope: "worker"}],

    guards: [async ({page}, use) => {
        const blocked: string[] = [];
        const pageErrors: string[] = [];

        await page.route(`${supabaseOrigin()}/**`, async (route) => {
            const request = route.request();
            if (request.method() === "GET" || request.method() === "HEAD") return route.continue();
            blocked.push(`${request.method()} ${request.url()}`);
            return route.abort("blockedbyclient");
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));

        await use();

        expect(blocked, "the E2E suite is read-only — these requests to Supabase were blocked").toEqual([]);
        expect(pageErrors, "uncaught errors in the page").toEqual([]);
    }, {auto: true}],
});

export {expect};

// Waits until the collection has data: the results header shows a count, not "Loading models…".
export async function waitForCollection(page: Page) {
    await expect(page.locator(".resultsHeaderCount")).toBeVisible();
}

// The grid's model links, in display order (each card/row is one link named by modelLinkLabel()).
export function modelLinks(page: Page) {
    return page.locator("main").locator("a.card, a.listRow, a.compactRow");
}
