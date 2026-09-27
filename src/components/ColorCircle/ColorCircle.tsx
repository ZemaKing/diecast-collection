import {getSwatchBackground} from "../../utils/color.ts";
import "./ColorCircle.css";

type ColorCircleProps = {
    hex: string[];
};

export function ColorCircle({hex}: ColorCircleProps) {
    const background = getSwatchBackground(hex);

    return <div className="circle" style={{background}}/>;
}
