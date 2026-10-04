// Browse, statistics, about, 404 and navigation journeys (ROADMAP Phase 35).
import {expect, modelLinks, test} from "./fixtures.ts";
import {largest, pluralModels} from "./support/data.ts";

for (const kind of ["brands", "manufacturers"] as const) {
    test(`${kind}: index lists every entry and its page shows its models`, async ({page, collection}) => {
        const entries = collection[kind];
        const top = largest(entries);

        await page.goto(`/${kind}`);
        await expect(page.locator("main a.browseTile")).toHaveCount(entries.size);
        // Default order: most models first.
        await expect(page.locator("main a.browseTile").first()).toHaveAttribute("href", `/${kind}/${top.slug}`);

        await page.locator(`main a.browseTile[href="/${kind}/${top.slug}"]`).click();
        await expect(page).toHaveURL(`/${kind}/${top.slug}`);
        await expect(page.getByRole("heading", {level: 1, name: top.name})).toBeVisible();
        await expect(modelLinks(page)).toHaveCount(top.count);

        // "Open in collection" hands off to the collection's filter with the same count.
        await page.getByRole("link", {name: /Open in collection/i}).click();
        const param = kind === "brands" ? "brand" : "manufacturer";
        await expect(page).toHaveURL(new RegExp(`/\\?${param}=${top.slug}`));
        await expect(page.locator(".resultsHeaderCount")).toHaveText(`${top.count} of ${pluralModels(collection.models.length)}`);
    });
}

test("a non-canonical brand slug redirects, an unknown one is a 404", async ({page, collection}) => {
    const top = largest(collection.brands);
    await page.goto(`/brands/${encodeURIComponent(top.name.toUpperCase())}`);
    await expect(page).toHaveURL(`/brands/${top.slug}`);

    await page.goto("/brands/no-such-brand-e2e");
    await expect(page.getByRole("heading", {level: 1, name: "Page not found"})).toBeVisible();
});

test("statistics counts match the collection", async ({page, collection}) => {
    await page.goto("/statistics");
    await expect(page.getByRole("heading", {level: 1, name: "The collection in numbers"})).toBeVisible();

    const tile = (label: string) => page.locator(".statTile").filter({has: page.locator(".statTileLabel", {hasText: new RegExp(`^${label}$`)})}).locator(".statTileValue");
    await expect(tile("Models")).toHaveText(collection.models.length.toLocaleString("en-US"));
    await expect(tile("Brands")).toHaveText(String(collection.brands.size));
    await expect(tile("Manufacturers")).toHaveText(String(collection.manufacturers.size));
    await expect(tile("Categories")).toHaveText(String(collection.categories.size));
});

test("header navigation reaches every page and moves focus to its heading", async ({page}) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", {name: "Primary"}).first();
    for (const [name, path] of [["Manufacturers", "/manufacturers"], ["Brands", "/brands"], ["Statistics", "/statistics"], ["About", "/about"], ["Collection", "/"]] as const) {
        await nav.getByRole("link", {name, exact: true}).click();
        await expect(page).toHaveURL(path);
        await expect(nav.getByRole("link", {name, exact: true})).toHaveAttribute("aria-current", "page");
        await expect(page.locator("h1")).toBeFocused();
    }
});

test("unknown routes render the 404 page with a way home", async ({page}) => {
    const response = await page.goto("/no-such-page-e2e");
    expect(response?.status()).toBe(200); // SPA fallback; the 404 is rendered client-side
    await expect(page.getByRole("heading", {level: 1, name: "Page not found"})).toBeVisible();
    await expect(page).toHaveTitle(/not found/i);
    await page.getByRole("main").getByRole("link").first().click();
    await expect(page).toHaveURL("/");
});

test("Skip to content moves focus to the main region", async ({page}) => {
    await page.goto("/about");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", {name: "Skip to content"});
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
});
