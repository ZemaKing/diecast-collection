type ColorCircleProps = {
    hex: string[];
};

export function ColorCircle({hex}: ColorCircleProps) {
    const background =
        hex.length === 1
            ? hex[0]
            : `conic-gradient(${hex
                .map((color, i) => {
                    const start = (i / hex.length) * 100;
                    const end = ((i + 1) / hex.length) * 100;
                    return `${color} ${start}% ${end}%`;
                })
                .join(", ")})`;

    return (
        <div
            style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background,
                border: "1px solid #121A27",
            }}
        />
    );
}
