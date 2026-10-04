import {describe, expect, it} from "vitest";

import carModelsData from "../data/car-models.json";
import {getSwatchBackground} from "./color.ts";

describe("getSwatchBackground", () => {
    it("uses a single hex as a flat color", () => {
        expect(getSwatchBackground(["#FF0000"])).toBe("#FF0000");
    });

    it("splits multiple hexes into equal conic-gradient slices, in order", () => {
        expect(getSwatchBackground(["#111", "#222"])).toBe("conic-gradient(#111 0% 50%, #222 50% 100%)");
        expect(getSwatchBackground(["#1", "#2", "#3", "#4"])).toBe(
            "conic-gradient(#1 0% 25%, #2 25% 50%, #3 50% 75%, #4 75% 100%)",
        );
    });

    it("does not round uneven slices", () => {
        expect(getSwatchBackground(["#a", "#b", "#c"])).toBe(
            "conic-gradient(#a 0% 33.33333333333333%, #b 33.33333333333333% 66.66666666666666%, #c 66.66666666666666% 100%)",
        );
    });

    // Unguarded on purpose: an empty livery is allowed, so every caller skips the swatch when it's empty.
    it("yields an empty gradient for an empty array", () => {
        expect(getSwatchBackground([])).toBe("conic-gradient()");
    });
});

describe("hex data on the real dataset", () => {
    const cars = carModelsData as {color: string[]; hex?: string[]}[];

    it("every car has 1–4 hex values, independent of how many color names it has", () => {
        const hexLengths = cars.map((m) => m.hex?.length ?? 0);
        expect(Math.min(...hexLengths)).toBe(1);
        expect(Math.max(...hexLengths)).toBe(4);
        // hex is the livery swatch, color is the filter bucket — they are not 1:1.
        expect(cars.filter((m) => m.hex!.length !== m.color.length)).toHaveLength(165);
    });
});
