// Mobile viewport smoke (ROADMAP Phase 35) — runs only in the "mobile" project (Pixel 7, touch).
import {expect, modelLinks, test, waitForCollection} from "./fixtures.ts";
import {largest} from "./support/data.ts";

async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
}

test("collection loads without horizontal scroll", async ({page, collection}) => {
    await page.goto("/");
    await waitForCollection(page);
    await expect(modelLinks(page)).toHaveCount(collection.models.length);
    await expectNoHorizontalScroll(page);
    // Touch-only: no hover Quick View buttons.
    await expect(page.locator(".quickViewTrigger").first()).toBeHidden();
});

test("the menu drawer opens, navigates and closes", async ({page}) => {
    await page.goto("/");
    const toggle = page.getByRole("button", {name: "Open menu"});
    await toggle.click();
    const drawer = page.locator(".mobileNav");
    await expect(drawer).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await drawer.getByRole("link", {name: "Statistics"}).click();
    await expect(page).toHaveURL("/statistics");
    await expect(drawer).toBeHidden();
    await expectNoHorizontalScroll(page);
});

test("the filter sheet filters by category and closes on Show", async ({page, collection}) => {
    const category = largest(collection.categories);
    await page.goto("/");
    await waitForCollection(page);

    await page.getByRole("button", {name: /^Filters/}).click();
    const sheet = page.getByRole("dialog", {name: "Filters"});
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", {name: new RegExp(`^${category.name}\\b`)}).click();
    await expect(page).toHaveURL(new RegExp(`category=${category.slug}`));

    await sheet.getByRole("button", {name: `Show ${category.count} models`}).click();
    await expect(sheet).toBeHidden();
    await expect(modelLinks(page)).toHaveCount(category.count);
});

test("search, open a model, and the details page fits the screen", async ({page, collection}) => {
    const model = collection.models[0]!;
    await page.goto("/");
    await waitForCollection(page);
    await page.getByRole("searchbox", {name: "Search models"}).fill(model.name);
    await expect(page.locator(`main a[id="${model.slug}"]`)).toBeVisible();

    await page.locator(`main a[id="${model.slug}"]`).tap();
    await expect(page.getByRole("heading", {level: 1, name: model.name})).toBeVisible();
    await expectNoHorizontalScroll(page);
});
