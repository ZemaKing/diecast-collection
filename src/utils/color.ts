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
