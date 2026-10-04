// Collection page journeys: load, filter, search, sort, view modes, deep links (ROADMAP Phase 35).
import {expect, modelLinks, test, waitForCollection} from "./fixtures.ts";
import {largest, pluralModels} from "./support/data.ts";

test("loads every published model", async ({page, collection}) => {
    await page.goto("/");
    await waitForCollection(page);

    const total = collection.models.length;
    await expect(page.locator(".resultsHeaderCount")).toHaveText(pluralModels(total));
    await expect(modelLinks(page)).toHaveCount(total);
    await expect(page).toHaveTitle(/ZemaKing/);
});

test("filters by brand from the toolbar, with chip and Clear all", async ({page, collection}) => {
    const brand = largest(collection.brands);
    const total = collection.models.length;

    await page.goto("/");
    await waitForCollection(page);

    const trigger = page.locator(".toolbarTriggers .filterTrigger").filter({has: page.locator("summary", {hasText: /^Brand/})});
    await trigger.locator("summary").click();
    await trigger.getByRole("checkbox", {name: new RegExp(`^${escape(brand.name)}\\b`)}).check();

    await expect(page).toHaveURL(new RegExp(`[?&]brand=${brand.slug}(&|$)`));
    await expect(page.locator(".resultsHeaderCount")).toHaveText(`${brand.count} of ${pluralModels(total)}`);
    await expect(modelLinks(page)).toHaveCount(brand.count);
    // Every visible model is that brand (link names carry the brand: modelLinkLabel()).
    for (const name of await modelLinks(page).evaluateAll((links) => links.map((a) => a.getAttribute("aria-label") ?? ""))) {
        expect(name).toContain(brand.name);
    }

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", {name: `Remove ${brand.name} filter`})).toBeVisible();
    await page.getByRole("button", {name: "Clear all"}).click();
    await expect(page).not.toHaveURL(/brand=/);
    await expect(modelLinks(page)).toHaveCount(total);
});

test("combines filters across fields (AND) and within a field (OR)", async ({page, collection}) => {
    const category = largest(collection.categories);
    const [first, second] = [...collection.manufacturers.keys()].sort();
    const expected = collection.models.filter((m) => m.category_slug === category.slug && (m.manufacturer_slug === first || m.manufacturer_slug === second));

    await page.goto(`/?category=${category.slug}&manufacturer=${first}&manufacturer=${second}`);
    await waitForCollection(page);
    if (expected.length === 0) {
        await expect(page.getByRole("button", {name: "Clear filters"})).toBeVisible();
    } else {
        await expect(modelLinks(page)).toHaveCount(expected.length);
    }
});

test("searches from the header box and writes ?q=", async ({page, collection}) => {
    const target = collection.models.find((m) => m.name.length > 6)!;
    const term = target.name.split(" ").find((w) => w.length >= 4) ?? target.name;

    await page.goto("/");
    await waitForCollection(page);
    await page.getByRole("searchbox", {name: "Search models"}).fill(term);

    await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(term).replace(/%20/g, "(\\+|%20)")}`));
    await expect(page.locator(".resultsHeaderDetail")).toContainText(`matching "${term}"`);
    await expect(page.locator(`main a[id="${target.slug}"]`)).toBeVisible();
    // Searching defaults the sort to Relevance.
    await expect(page.locator(".sortTriggerSummary")).toContainText("Relevance");
});

test("an unmatched search shows the empty state, and Clear search restores the grid", async ({page, collection}) => {
    await page.goto("/?q=zzzzqqqq");
    await expect(page.locator("main .stateTitle")).toHaveText(`No models match "zzzzqqqq"`);
    await expect(page.getByRole("main").getByRole("button", {name: "Clear search"})).toBeVisible();
    await page.getByRole("main").getByRole("button", {name: "Clear search"}).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(modelLinks(page)).toHaveCount(collection.models.length);
});

test("sorts by year (newest first) via ?sort=", async ({page, collection}) => {
    await page.goto("/");
    await waitForCollection(page);

    await page.locator(".sortTriggerSummary").click();
    await page.getByRole("button", {name: "Year: newest", exact: true}).click();
    await expect(page).toHaveURL(/[?&]sort=year-desc/);

    const newest = Math.max(...collection.models.map((m) => m.year));
    const firstSlug = await modelLinks(page).first().getAttribute("id");
    expect(collection.bySlug.get(firstSlug!)?.year).toBe(newest);

    const years = await modelLinks(page).evaluateAll((links) => links.map((a) => a.id));
    const sequence = years.map((slug) => collection.bySlug.get(slug)!.year);
    expect(sequence).toEqual([...sequence].sort((a, b) => b - a));
});

test("a shared deep link restores filters, search and sort", async ({page, collection}) => {
    const category = largest(collection.categories);
    await page.goto(`/?category=${category.slug}&sort=name-asc`);
    await waitForCollection(page);

    await expect(page.locator(".resultsHeaderCount")).toHaveText(`${category.count} of ${pluralModels(collection.models.length)}`);
    await expect(page.locator(".sortTriggerSummary")).toContainText("Model A–Z");
    const names = await modelLinks(page).evaluateAll((links) => links.map((a) => a.id));
    const expected = collection.models.filter((m) => m.category_slug === category.slug)
        .sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug)).map((m) => m.slug);
    expect(names).toEqual(expected);
});

test("legacy links: /cars keeps its query, ?model= opens the details page", async ({page, collection}) => {
    const brand = largest(collection.brands);
    await page.goto(`/cars?brand=${encodeURIComponent(brand.name)}`);
    await expect(page).toHaveURL(new RegExp(`/\\?brand=`));
    await waitForCollection(page);
    await expect(modelLinks(page)).toHaveCount(brand.count);

    const model = collection.models[0]!;
    await page.goto(`/?model=${model.slug}`);
    await expect(page).toHaveURL(`/models/${model.slug}`);
    await expect(page.getByRole("heading", {level: 1, name: model.name})).toBeVisible();
});

test("view modes switch the layout and persist across reloads", async ({page, collection}) => {
    await page.goto("/");
    await waitForCollection(page);

    await page.getByRole("button", {name: "List view"}).click();
    await expect(page.getByRole("button", {name: "List view"})).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("main a.listRow")).toHaveCount(collection.models.length);
    await expect(page).not.toHaveURL(/view/); // a per-browser preference, never in the URL

    await page.reload();
    await waitForCollection(page);
    await expect(page.locator("main a.listRow")).toHaveCount(collection.models.length);

    await page.getByRole("button", {name: "Compact view"}).click();
    await expect(page.locator("main a.compactRow")).toHaveCount(collection.models.length);
    await page.getByRole("button", {name: "Grid view"}).click();
    await expect(page.locator("main a.card")).toHaveCount(collection.models.length);
});

test("opening a model and returning via the breadcrumb keeps the filters and focuses the model", async ({page, collection}) => {
    const category = largest(collection.categories);
    await page.goto(`/?category=${category.slug}&sort=name-desc`);
    await waitForCollection(page);

    const link = modelLinks(page).nth(5);
    const slug = (await link.getAttribute("id"))!;
    await link.click();

    await expect(page).toHaveURL(`/models/${slug}`);
    await expect(page.getByRole("heading", {level: 1, name: collection.bySlug.get(slug)!.name})).toBeVisible();

    await page.getByRole("navigation", {name: "Breadcrumb"}).getByRole("link", {name: "Collection"}).click();
    await expect(page).toHaveURL(new RegExp(`/\\?category=${category.slug}&sort=name-desc$`));
    await expect(page.locator(`main a[id="${slug}"]`)).toBeFocused();
});

test("browser Back from a model restores the collection", async ({page, collection}) => {
    await page.goto("/?sort=name-asc");
    await waitForCollection(page);
    const link = modelLinks(page).nth(2);
    const slug = (await link.getAttribute("id"))!;
    await link.click();
    await expect(page).toHaveURL(`/models/${slug}`);
    await page.goBack();
    await expect(page).toHaveURL("/?sort=name-asc");
    await expect(modelLinks(page)).toHaveCount(collection.models.length);
});

test("Quick View opens from a card, shows the model, and closes with Escape", async ({page, collection}) => {
    await page.goto("/?sort=name-asc");
    await waitForCollection(page);
    const first = collection.models.slice().sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug))[0]!;

    const trigger = page.getByRole("button", {name: `Quick view: ${first.name}`});
    await page.locator(`.cardShell[data-slug="${first.slug}"]`).hover();
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", {name: first.name})).toBeVisible();
    await expect(dialog.getByRole("link", {name: /View Details/i})).toHaveAttribute("href", `/models/${first.slug}`);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
});

function escape(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
