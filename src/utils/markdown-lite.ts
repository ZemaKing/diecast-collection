// Markdown-lite (ROADMAP Phase 26, owner's choice): the model description is stored as the text the
// owner typed — never HTML — and turned into a small tree that <MarkdownLite> renders as React
// elements. Nothing here ever produces an HTML string, so there is nothing to sanitize: every
// character of the source ends up as text content, and links only get through for http(s)/mailto.
//
// Supported, and nothing else:
//   paragraphs          blank line between them; a single newline is a line break
//   - item / * item     bullet list
//   1. item             numbered list (the first number is the start)
//   **bold**  *italic*  _italic_   [text](https://…)   \* (a literal character)

export type Inline =
    | {type: "text"; text: string}
    | {type: "strong"; children: Inline[]}
    | {type: "em"; children: Inline[]}
    | {type: "link"; href: string; children: Inline[]}
    | {type: "break"};

export type Block =
    | {type: "paragraph"; children: Inline[]}
    | {type: "list"; ordered: boolean; start: number; items: Inline[][]};

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/y;
const ESCAPABLE = new Set(["\\", "*", "_", "[", "]", "(", ")", "-", "#"]);

// Only these schemes become links; anything else (javascript:, data:, relative paths…) is text.
export function safeHref(url: string): string | null {
    const trimmed = url.trim();
    if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return trimmed;
    if (/^mailto:[^\s@]+@[^\s@]+$/i.test(trimmed)) return trimmed;
    return null;
}

export function parseMarkdownLite(source: string): Block[] {
    const blocks: Block[] = [];
    let paragraph: string[] | null = null;
    let list: {ordered: boolean; start: number; items: string[]} | null = null;

    const flush = () => {
        if (paragraph) blocks.push({type: "paragraph", children: parseLines(paragraph)});
        if (list) blocks.push({type: "list", ordered: list.ordered, start: list.start, items: list.items.map((i) => parseInline(i))});
        paragraph = null;
        list = null;
    };

    for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
        if (!line.trim()) {
            flush();
            continue;
        }
        const bullet = BULLET.exec(line);
        const numbered = bullet ? null : NUMBERED.exec(line);
        if (bullet || numbered) {
            const ordered = !!numbered;
            const text = (bullet ? bullet[1] : numbered![2]).trim();
            if (!list || list.ordered !== ordered) {
                flush();
                list = {ordered, start: numbered ? Number(numbered[1]) : 1, items: []};
            }
            list.items.push(text);
            continue;
        }
        if (list) flush();
        (paragraph ??= []).push(line.trim());
    }
    flush();
    return blocks;
}

// A paragraph's lines, joined by line breaks.
function parseLines(lines: string[]): Inline[] {
    return lines.flatMap((line, i) => (i === 0 ? parseInline(line) : [{type: "break"} as Inline, ...parseInline(line)]));
}

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

export function parseInline(text: string): Inline[] {
    const out: Inline[] = [];
    let buffer = "";
    const pushText = () => {
        if (buffer) out.push({type: "text", text: buffer});
        buffer = "";
    };

    let i = 0;
    while (i < text.length) {
        const c = text[i];

        if (c === "\\" && ESCAPABLE.has(text[i + 1] ?? "")) {
            buffer += text[i + 1];
            i += 2;
            continue;
        }

        if (text.startsWith("**", i)) {
            const close = text.indexOf("**", i + 2);
            if (close > i + 2) {
                pushText();
                out.push({type: "strong", children: parseInline(text.slice(i + 2, close))});
                i = close + 2;
                continue;
            }
        }

        // *italic* / _italic_: no space just inside the markers; `_` must not sit inside a word
        // (snake_case stays as typed).
        if ((c === "*" || c === "_") && text[i + 1] && text[i + 1] !== " " && text[i + 1] !== c && !(c === "_" && isWordChar(text[i - 1]))) {
            let close = text.indexOf(c, i + 1);
            while (close !== -1 && (text[close - 1] === " " || text[close + 1] === c || (c === "_" && isWordChar(text[close + 1])))) {
                close = text.indexOf(c, close + 1);
            }
            if (close > i + 1) {
                pushText();
                out.push({type: "em", children: parseInline(text.slice(i + 1, close))});
                i = close + 1;
                continue;
            }
        }

        if (c === "[") {
            LINK.lastIndex = i;
            const match = LINK.exec(text);
            if (match) {
                pushText();
                const href = safeHref(match[2]);
                const children = parseInline(match[1]);
                // An unsafe URL keeps its visible text and loses the link.
                if (href) out.push({type: "link", href, children});
                else out.push(...children);
                i += match[0].length;
                continue;
            }
        }

        buffer += c;
        i += 1;
    }
    pushText();
    return out;
}

// ---- editor toolbar ---------------------------------------------------------------------------

export type MarkdownFormat = "bold" | "italic" | "bullet" | "numbered" | "link";

// One toolbar action on a textarea: replace [replaceStart, replaceEnd) with `text`, then select
// [selectStart, selectEnd) — offsets in the NEW value.
export type FormatEdit = {replaceStart: number; replaceEnd: number; text: string; selectStart: number; selectEnd: number};

export function applyMarkdownFormat(value: string, start: number, end: number, format: MarkdownFormat): FormatEdit {
    const selected = value.slice(start, end);

    if (format === "bold" || format === "italic") {
        const marker = format === "bold" ? "**" : "*";
        const inner = selected || (format === "bold" ? "bold text" : "italic text");
        return {
            replaceStart: start,
            replaceEnd: end,
            text: `${marker}${inner}${marker}`,
            selectStart: start + marker.length,
            selectEnd: start + marker.length + inner.length,
        };
    }

    if (format === "link") {
        const label = selected || "link text";
        const url = "https://";
        const text = `[${label}](${url})`;
        const urlStart = start + label.length + 3;
        return {replaceStart: start, replaceEnd: end, text, selectStart: urlStart, selectEnd: urlStart + url.length};
    }

    // Lists work on whole lines: every selected line gets (or, if all have it, loses) the prefix.
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = value.indexOf("\n", end > start && value[end - 1] === "\n" ? end - 1 : end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const lines = value.slice(lineStart, lineEnd).split("\n");
    const pattern = format === "bullet" ? BULLET : NUMBERED;
    const content = lines.filter((l) => l.trim());
    const removing = content.length > 0 && content.every((l) => pattern.test(l));

    let n = 0;
    const next = lines.map((line) => {
        if (!line.trim()) return line;
        if (removing) return (format === "bullet" ? BULLET : NUMBERED).exec(line)![format === "bullet" ? 1 : 2];
        const bare = BULLET.exec(line)?.[1] ?? NUMBERED.exec(line)?.[2] ?? line;
        n += 1;
        return format === "bullet" ? `- ${bare}` : `${n}. ${bare}`;
    });
    const text = next.join("\n") || (format === "bullet" ? "- " : "1. ");
    return {replaceStart: lineStart, replaceEnd: lineEnd, text, selectStart: lineStart + text.length, selectEnd: lineStart + text.length};
}
