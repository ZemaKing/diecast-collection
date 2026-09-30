// A single hex renders as a flat color; several render as equal conic-gradient slices.
export function getSwatchBackground(hex: string[]): string {
    return hex.length === 1
        ? hex[0]
        : `conic-gradient(${hex
            .map((color, i) => {
                const start = (i / hex.length) * 100;
                const end = ((i + 1) / hex.length) * 100;
                return `${color} ${start}% ${end}%`;
            })
            .join(", ")})`;
}

// The DB's `colors.hex` is NULL for "Multi" (a livery is multiple colors, not one) — there's no
// single real hex to show, so this is a generic representative swatch (existing feedback tokens,
// not tied to any one model's actual livery). Used by the Color filter and the Statistics page.
export const MULTI_SWATCH_HEX = ["var(--color-danger)", "var(--color-warning)", "var(--color-info)", "var(--color-success)"];

// A color row's swatch: its real hex, or the generic multi swatch when it has none.
export function colorSwatchHex(hex: string | null | undefined): string[] {
    return hex ? [hex] : MULTI_SWATCH_HEX;
}
