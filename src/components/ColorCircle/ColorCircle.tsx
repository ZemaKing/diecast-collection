import "./ColorCircle.css";

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

    return <div className="circle" style={{background}}/>;
}
