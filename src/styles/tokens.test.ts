// Guards for the design-token system (ROADMAP Phase 3):
//  - every var(--x) used anywhere in src is actually defined
//  - no NEW hard-coded colors outside styles.css (ratchet: counts may only go down)
//  - breakpoints documented in styles.css match breakpoints.ts
//  - every category in the data has a color token in both themes
import {describe, expect, it} from "vitest";

import tokensCss from "./styles.css?raw";
import carModelsData from "../data/car-models.json";
import {BREAKPOINTS, MEDIA, breakpointFor} from "./breakpoints.ts";
import {categorySlug} from "../utils/category.ts";

const sources = import.meta.glob<string>("../**/*.{css,tsx,ts}", {query: "?raw", import: "default", eager: true});
const sourceFiles = Object.entries(sources).filter(([path]) => !path.endsWith(".test.ts"));

const definedTokens = new Set([...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

function themeBlock(selector: string): string {
    const start = tokensCss.indexOf(`${selector} {`);
    return tokensCss.slice(start, tokensCss.indexOf("\n}", start));
}

describe("token references", () => {
    it("every var(--x) used in src is defined in styles.css", () => {
        const missing: string[] = [];
        for (const [path, content] of sourceFiles) {
            for (const [, name] of content.matchAll(/var\((--[\w-]+)/g)) {
                // `--cat-${…}` is built dynamically in category.ts — covered by the category test below
                if (!definedTokens.has(name) && name !== "--cat-") missing.push(`${path}: ${name}`);
            }
        }
        expect(missing).toEqual([]);
    });
});

describe("no new hard-coded colors outside styles.css", () => {
    // Pre-redesign debt, removed as those components are rebuilt. Lower these, never raise them.
    const ALLOWED: Record<string, number> = {
        "../components/Header/Header.css": 2,
    };
    const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g;

    it.each(sourceFiles.filter(([path]) => /\.(css|tsx)$/.test(path) && !path.endsWith("styles.css")))(
        "%s",
        (path, content) => {
            const count = (content.match(COLOR) ?? []).length;
            expect(count, "use a token from styles.css instead").toBeLessThanOrEqual(ALLOWED[path] ?? 0);
        },
    );
});

describe("breakpoints", () => {
    it("styles.css documents the same values as breakpoints.ts", () => {
        expect(tokensCss).toContain(`<  ${BREAKPOINTS.tablet}px`);
        expect(tokensCss).toContain(`${BREAKPOINTS.tablet}–${BREAKPOINTS.desktop - 1}px → @media ${MEDIA.tabletUp}`);
        expect(tokensCss).toContain(`≥ ${BREAKPOINTS.desktop}px   → @media ${MEDIA.desktopUp}`);
        expect(tokensCss).toContain(`≥ ${BREAKPOINTS.wide}px   → @media ${MEDIA.wideUp}`);
        expect(tokensCss).toContain(`@media ${MEDIA.mobile}`);
    });

    it.each([
        [360, "mobile"], [639, "mobile"], [640, "tablet"], [1023, "tablet"],
        [1024, "desktop"], [1599, "desktop"], [1600, "wide"], [2560, "wide"],
    ] as const)("%ipx → %s", (width, expected) => {
        expect(breakpointFor(width)).toBe(expected);
    });
});

describe("category color tokens", () => {
    const categories = [...new Set(carModelsData.map((m) => m.category))];
    const dark = themeBlock(":root");
    const light = themeBlock('[data-theme="light"]');

    it.each(categories)("%s has a dark and a light token", (category) => {
        const token = `--cat-${categorySlug(category)}:`;
        expect(dark).toContain(token);
        expect(light).toContain(token);
    });

    it("defines a fallback", () => {
        expect(dark).toContain("--cat-fallback:");
    });
});
