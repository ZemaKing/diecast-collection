// Auth guard + read-side RLS checks (ROADMAP Phase 35). Read-only by the owner's decision: no
// sign-in, no write attempts here — write denials are proven by `npm run verify:rls`, which uses
// throw-away fixtures and cleans up after itself.
import {expect, test} from "./fixtures.ts";
import {restGet} from "./support/data.ts";

test("signed out, /admin redirects to the sign-in page", async ({page}) => {
    await page.goto("/admin");
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", {level: 1, name: "Sign in"})).toBeVisible();
    await expect(page.getByRole("textbox", {name: "Email"})).toBeVisible();
    await expect(page.getByLabel("Password", {exact: true})).toBeVisible();
});

test("signed out, deep admin URLs redirect too", async ({page}) => {
    for (const path of ["/admin/models/new", "/admin/data?tab=brands", "/admin/models/anything/edit"]) {
        await page.goto(path);
        await expect(page).toHaveURL("/login");
    }
});

test("signed out, the header shows no admin UI", async ({page}) => {
    await page.goto("/");
    await expect(page.getByRole("link", {name: /Add Model|Admin/i})).toHaveCount(0);
});

test.describe("RLS as a signed-out visitor (anon key)", () => {
    test("private notes are invisible", async () => {
        const response = await restGet("model_private_notes?select=*&limit=5");
        // Either refused outright or filtered to nothing — never any rows.
        if (response.ok) expect(await response.json()).toEqual([]);
        else expect([401, 403]).toContain(response.status);
    });

    test("the admin list is invisible", async () => {
        const response = await restGet("admin_users?select=*&limit=5");
        if (response.ok) expect(await response.json()).toEqual([]);
        else expect([401, 403]).toContain(response.status);
    });

    test("drafts are invisible", async () => {
        const response = await restGet("model_summaries?select=slug&is_published=eq.false&limit=5");
        expect(response.ok).toBe(true);
        expect(await response.json()).toEqual([]);
    });

    test("is_admin() is false", async () => {
        const response = await restGet("rpc/is_admin");
        expect(response.ok).toBe(true);
        expect(await response.json()).toBe(false);
    });
});
