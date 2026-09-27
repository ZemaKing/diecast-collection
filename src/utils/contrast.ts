// WCAG 2.x relative luminance / contrast ratio for opaque #rgb or #rrggbb colors.
function channel(value: number): number {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function parseHex(hex: string): [number, number, number] {
    let h = hex.trim().replace(/^#/, "");
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Not an opaque hex color: ${hex}`);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
    const [r, g, b] = parseHex(hex).map(channel);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
