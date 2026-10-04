// Model details page + gallery/lightbox journeys (ROADMAP Phase 35).
import {expect, test} from "./fixtures.ts";
import {restGet, type PublishedModel} from "./support/data.ts";

function pick(models: PublishedModel[]): PublishedModel {
    // Deterministic: first by slug, so a failure always points at the same model.
    return [...models].sort((a, b) => a.slug.localeCompare(b.slug))[0]!;
}

test("a deep link renders the model with breadcrumb, specs and title", async ({page, collection}) => {
    const model = pick(collection.models);
    await page.goto(`/models/${model.slug}`);

    await expect(page.getByRole("heading", {level: 1, name: model.name})).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(escape(model.name)));

    const crumbs = page.getByRole("navigation", {name: "Breadcrumb"});
    await expect(crumbs.getByRole("link", {name: "Collection"})).toHaveAttribute("href", "/");
    await expect(crumbs.getByRole("link", {name: model.brand_name})).toHaveAttribute("href", `/brands/${model.brand_slug}`);

    // Brand / Manufacturer spec tiles link to their browse pages.
    await expect(page.locator(`main a[href="/manufacturers/${model.manufacturer_slug}"]`).first()).toBeVisible();
});

test("tabs switch panels and the open tab is kept in ?tab=", async ({page, collection}) => {
    // Tabs only render when a model has more than one section — Specifications is always there,
    // My Collection appears with an added date / condition / location.
    const response = await restGet("model_summaries?select=slug&is_published=eq.true&or=(added_at.not.is.null,condition.not.is.null,location.not.is.null)&order=slug&limit=1");
    const [row] = (await response.json()) as {slug: string}[];
    test.skip(!row, "no published model has more than one details tab");
    const model = collection.bySlug.get(row!.slug)!;
    await page.goto(`/models/${model.slug}`);
    await expect(page.getByRole("heading", {level: 1})).toBeVisible();

    const tabs = page.getByRole("tablist", {name: "Model information"});
    const first = tabs.getByRole("tab").first();
    const collectionTab = tabs.getByRole("tab", {name: "My Collection"});
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(page).not.toHaveURL(/tab=/); // the default tab is never written

    await collectionTab.click();
    await expect(page).toHaveURL(/[?&]tab=collection/);
    await expect(collectionTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toBeVisible();

    await page.reload();
    await expect(collectionTab).toHaveAttribute("aria-selected", "true");

    // Arrow keys move between tabs (WAI-ARIA tabs pattern) and select them.
    await collectionTab.focus();
    await page.keyboard.press("Home");
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute("aria-selected", "true");
});

test("the photo opens fullscreen and Escape returns focus to the button", async ({page, collection}) => {
    const model = pick(collection.models.filter((m) => m.image_count > 0));
    await page.goto(`/models/${model.slug}`);

    const open = page.getByRole("button", {name: "View photo fullscreen"});
    await open.click();
    const lightbox = page.getByRole("dialog", {name: `${model.name} — photos`});
    await expect(lightbox).toBeVisible();
    await expect(lightbox.getByRole("button", {name: "Close photo viewer"})).toBeFocused();
    // The full-size image actually loads (not the "Image unavailable" fallback).
    await expect.poll(() => lightbox.locator("img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(lightbox).toBeHidden();
    await expect(open).toBeFocused();
});

test("a multi-photo model pages through its gallery", async ({page, collection}) => {
    const model = collection.models.find((m) => m.image_count > 1);
    test.skip(!model, "no published model has more than one photo yet");

    await page.goto(`/models/${model!.slug}`);
    const counter = page.locator(".galleryCounter");
    await expect(counter).toHaveText(`1 / ${model!.image_count}`);
    await page.getByRole("button", {name: "Next photo"}).first().click();
    await expect(counter).toHaveText(`2 / ${model!.image_count}`);
    await page.getByRole("button", {name: "Previous photo"}).first().click();
    await page.getByRole("button", {name: "Previous photo"}).first().click();
    await expect(counter).toHaveText(`${model!.image_count} / ${model!.image_count}`); // wraps around
});

test("an unknown model slug renders the 404 page", async ({page}) => {
    await page.goto("/models/no-such-model-e2e");
    await expect(page.getByRole("heading", {level: 1, name: "Page not found"})).toBeVisible();
});

function escape(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
