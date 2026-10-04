import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {MarkdownLite} from "../components/MarkdownLite/MarkdownLite.tsx";
import {applyMarkdownFormat, parseInline, parseMarkdownLite, safeHref} from "./markdown-lite.ts";

const html = (source: string) => renderToStaticMarkup(createElement(MarkdownLite, {source}));

describe("parseMarkdownLite — blocks", () => {
    it("splits paragraphs on blank lines and keeps single newlines as breaks", () => {
        expect(parseMarkdownLite("One\ntwo\n\n\nThree")).toEqual([
            {type: "paragraph", children: [{type: "text", text: "One"}, {type: "break"}, {type: "text", text: "two"}]},
            {type: "paragraph", children: [{type: "text", text: "Three"}]},
        ]);
    });

    it("reads bullet and numbered lists, even right after a paragraph", () => {
        const blocks = parseMarkdownLite("Features:\n- Mid-engine\n* 6.2L V8\n\n3. Third\n4. Fourth");
        expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list", "list"]);
        expect(blocks[1]).toMatchObject({ordered: false, items: [[{text: "Mid-engine"}], [{text: "6.2L V8"}]]});
        expect(blocks[2]).toMatchObject({ordered: true, start: 3});
    });

    it("normalizes Windows line endings and ignores empty input", () => {
        expect(parseMarkdownLite("a\r\n\r\nb")).toHaveLength(2);
        expect(parseMarkdownLite("  \n\n ")).toEqual([]);
    });
});

describe("parseInline", () => {
    it("reads bold, italic (both markers) and nesting", () => {
        expect(parseInline("a **b *c* d** _e_")).toEqual([
            {type: "text", text: "a "},
            {type: "strong", children: [{type: "text", text: "b "}, {type: "em", children: [{type: "text", text: "c"}]}, {type: "text", text: " d"}]},
            {type: "text", text: " "},
            {type: "em", children: [{type: "text", text: "e"}]},
        ]);
    });

    it("leaves ordinary asterisks, snake_case and escapes as typed", () => {
        expect(parseInline("2 * 3 = 6")).toEqual([{type: "text", text: "2 * 3 = 6"}]);
        expect(parseInline("model_code_x")).toEqual([{type: "text", text: "model_code_x"}]);
        expect(parseInline("\\*not italic\\*")).toEqual([{type: "text", text: "*not italic*"}]);
        expect(parseInline("**unclosed")).toEqual([{type: "text", text: "**unclosed"}]);
    });

    it("links only http(s) and mailto", () => {
        expect(parseInline("[Ixo](https://ixomodels.com)")).toEqual([
            {type: "link", href: "https://ixomodels.com", children: [{type: "text", text: "Ixo"}]},
        ]);
        expect(parseInline("[click](javascript:alert(1))")).not.toContainEqual(expect.objectContaining({type: "link"}));
    });
});

describe("safeHref", () => {
    it("accepts web and mail links only", () => {
        expect(safeHref("https://example.com/a?b=c")).toBe("https://example.com/a?b=c");
        expect(safeHref("mailto:owner@example.com")).toBe("mailto:owner@example.com");
        for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>", "/relative", "vbscript:x", "https://"]) {
            expect(safeHref(bad), bad).toBeNull();
        }
    });
});

describe("<MarkdownLite> — XSS (ROADMAP Phase 26 verification)", () => {
    it("renders markup typed into a description as text, never as elements", () => {
        const out = html('<script>alert("x")</script> <img src=x onerror=alert(1)> <b onclick="x">b</b>');
        expect(out).not.toMatch(/<script|<img|<b /);
        expect(out).toContain("&lt;script&gt;");
        expect(out).toContain("&lt;img src=x onerror=alert(1)&gt;");
    });

    it("drops dangerous link targets but keeps their text", () => {
        const out = html("[click me](javascript:alert(1)) [data](data:text/html;base64,PHNjcmlwdD4=)");
        expect(out).not.toMatch(/href=|javascript:alert\(1\)"|<a /);
        expect(out).toContain("click me");
    });

    it("can't break out of an attribute through a link", () => {
        const out = html('[x](https://example.com/"onmouseover="alert(1))');
        expect(out).not.toMatch(/onmouseover="alert/);
    });

    it("renders the supported formatting", () => {
        expect(html("**Bold** and *it*\n\n- one\n- two\n\n[site](https://example.com)")).toBe(
            '<div class="markdownLite"><p><strong>Bold</strong> and <em>it</em></p><ul><li>one</li><li>two</li></ul>' +
            '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">site</a></p></div>',
        );
    });
});

describe("applyMarkdownFormat (toolbar)", () => {
    const run = (value: string, start: number, end: number, format: Parameters<typeof applyMarkdownFormat>[3]) => {
        const edit = applyMarkdownFormat(value, start, end, format);
        const next = value.slice(0, edit.replaceStart) + edit.text + value.slice(edit.replaceEnd);
        return {next, selected: next.slice(edit.selectStart, edit.selectEnd)};
    };

    it("wraps the selection in bold/italic markers and keeps it selected", () => {
        expect(run("a fast car", 2, 6, "bold")).toEqual({next: "a **fast** car", selected: "fast"});
        expect(run("a fast car", 2, 6, "italic")).toEqual({next: "a *fast* car", selected: "fast"});
    });

    it("inserts placeholder text when nothing is selected", () => {
        expect(run("x ", 2, 2, "bold")).toEqual({next: "x **bold text**", selected: "bold text"});
    });

    it("makes a link and selects the URL to type over", () => {
        expect(run("see Ixo", 4, 7, "link")).toEqual({next: "see [Ixo](https://)", selected: "https://"});
    });

    it("turns whole lines into a list, and back", () => {
        const text = "Intro\nMid-engine\nV8\nOutro";
        const listed = run(text, 8, 18, "bullet").next; // "d-engine\nV" — touches lines 2–3
        expect(listed).toBe("Intro\n- Mid-engine\n- V8\nOutro");
        expect(run(listed, 8, 21, "bullet").next).toBe(text);
        expect(run(text, 8, 12, "bullet").next).toBe("Intro\n- Mid-engine\nV8\nOutro"); // one line only
        expect(run(text, 6, 19, "numbered").next).toBe("Intro\n1. Mid-engine\n2. V8\nOutro");
    });

    it("starts an empty list item on an empty line", () => {
        expect(run("", 0, 0, "bullet").next).toBe("- ");
    });
});
