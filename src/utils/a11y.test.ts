import {describe, expect, it} from "vitest";

import {FOCUSABLE_SELECTOR, SITE_NAME, formatPageTitle, wrapFocusTarget} from "./a11y.ts";

describe("formatPageTitle", () => {
    it("puts the page first and the site name after it", () => {
        expect(formatPageTitle("Statistics")).toBe(`Statistics · ${SITE_NAME}`);
    });

    it("is the site name alone without a title", () => {
        expect(formatPageTitle()).toBe(SITE_NAME);
        expect(formatPageTitle(null)).toBe(SITE_NAME);
        expect(formatPageTitle("   ")).toBe(SITE_NAME);
    });

    it("trims the page title", () => {
        expect(formatPageTitle("  Brands ")).toBe(`Brands · ${SITE_NAME}`);
    });
});

describe("wrapFocusTarget", () => {
    const items = ["close", "pill", "apply"];

    it("lets the browser move focus between inner items", () => {
        expect(wrapFocusTarget(items, "close", false)).toBeNull();
        expect(wrapFocusTarget(items, "apply", true)).toBeNull();
    });

    it("wraps forward from the last item and backward from the first", () => {
        expect(wrapFocusTarget(items, "apply", false)).toBe("close");
        expect(wrapFocusTarget(items, "close", true)).toBe("apply");
    });

    it("pulls focus back in from outside the trap", () => {
        expect(wrapFocusTarget(items, null, false)).toBe("close");
        expect(wrapFocusTarget(items, "elsewhere", false)).toBe("close");
        expect(wrapFocusTarget(items, "elsewhere", true)).toBe("apply");
    });

    it("keeps a single item focused", () => {
        expect(wrapFocusTarget(["only"], "only", false)).toBe("only");
        expect(wrapFocusTarget(["only"], "only", true)).toBe("only");
    });

    it("does nothing when nothing is focusable", () => {
        expect(wrapFocusTarget([], null, false)).toBeNull();
    });
});

describe("FOCUSABLE_SELECTOR", () => {
    it("matches focusable elements and skips disabled / programmatic-only ones", () => {
        document.body.innerHTML = `
            <a href="/x" id="link"></a><a id="anchor-no-href"></a>
            <button id="btn"></button><button id="btn-disabled" disabled></button>
            <input id="input"><input type="hidden" id="hidden">
            <details><summary id="summary">More</summary></details>
            <div tabindex="0" id="tab0"></div><div tabindex="-1" id="tab-1"></div>`;
        const ids = [...document.querySelectorAll(FOCUSABLE_SELECTOR)].map((el) => el.id);
        expect(ids).toEqual(["link", "btn", "input", "summary", "tab0"]);
    });
});
