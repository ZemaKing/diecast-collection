// Contrast of text-bearing tokens against every surface they can sit on, per theme.
// Mirrors the table in docs/DESIGN-TOKENS.md. Target: WCAG AA 4.5:1 for text.
import {describe, expect, it} from "vitest";

import tokensCss from "./styles.css?raw";
import {contrastRatio, parseHex} from "../utils/contrast.ts";

function readTheme(selector: string): Record<string, string> {
    const start = tokensCss.indexOf(`${selector} {`);
    const block = tokensCss.slice(start, tokensCss.indexOf("\n}", start));
    return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map((m) => [m[1], m[2]]));
}

const dark = readTheme(":root");
const light = {...dark, ...readTheme('[data-theme="light"]')};

const SURFACES = ["--color-bg", "--color-bg-elevated", "--color-surface", "--color-surface-sunken", "--color-surface-raised", "--color-surface-hover"];
const TEXT = [
    "--color-text", "--color-text-secondary", "--color-text-muted", "--color-accent-text",
    "--color-success", "--color-info", "--color-warning", "--color-danger",
    "--cat-rally", "--cat-racing", "--cat-supercar", "--cat-premium", "--cat-retro",
];

describe("contrastRatio", () => {
    it("matches known WCAG values", () => {
        expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5);
        expect(contrastRatio("#fff", "#fff")).toBeCloseTo(1, 5);
        expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    });

    it("rejects non-opaque colors", () => {
        expect(() => parseHex("rgba(0,0,0,.5)")).toThrow();
    });
});

describe.each([["dark", dark], ["light", light]] as const)("%s theme", (_name, theme) => {
    for (const fg of TEXT) {
        it.each(SURFACES)(`${fg} on %s ≥ 4.5:1`, (bg) => {
            expect(contrastRatio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
        });
    }

    it("text on the gold accent fill ≥ 4.5:1", () => {
        expect(contrastRatio(theme["--color-on-accent"], theme["--color-accent"])).toBeGreaterThanOrEqual(4.5);
    });

    it.each(SURFACES)("chart bars are visible on %s (≥ 3:1, non-text)", (bg) => {
        expect(contrastRatio(theme["--chart-bar"], theme[bg])).toBeGreaterThanOrEqual(3);
    });

    it("focus ring is visible against the page (≥ 3:1, non-text)", () => {
        const ring = theme["--focus-ring-color"] ?? theme["--color-accent"];
        expect(contrastRatio(ring, theme["--color-bg"])).toBeGreaterThanOrEqual(3);
    });
});
