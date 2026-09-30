import {afterEach, describe, expect, it, vi} from "vitest";

import {downscaleSteps, extensionFor, fitWithin, resizeImage, resizeImageVariants} from "./image-resize.ts";

describe("fitWithin", () => {
    it("fits inside the box keeping the aspect ratio", () => {
        expect(fitWithin(1077, 800, 400)).toEqual({width: 400, height: 297});
        expect(fitWithin(900, 1200, 400)).toEqual({width: 300, height: 400});
        expect(fitWithin(4000, 1000, 1600, 300)).toEqual({width: 1200, height: 300});
    });

    it("never enlarges", () => {
        expect(fitWithin(1077, 800, 1600)).toEqual({width: 1077, height: 800});
    });

    it("rejects empty sizes", () => {
        expect(() => fitWithin(0, 10, 100)).toThrow();
        expect(() => fitWithin(10, 10, 0)).toThrow();
    });
});

describe("downscaleSteps", () => {
    it("halves until within 2× of the target, then lands on it", () => {
        expect(downscaleSteps({width: 4000, height: 3000}, {width: 400, height: 300})).toEqual([
            {width: 2000, height: 1500},
            {width: 1000, height: 750},
            {width: 500, height: 375},
            {width: 400, height: 300},
        ]);
        expect(downscaleSteps({width: 1077, height: 800}, {width: 400, height: 297})).toEqual([
            {width: 539, height: 400},
            {width: 400, height: 297},
        ]);
    });

    it("is a single draw for small or no reductions", () => {
        expect(downscaleSteps({width: 1077, height: 800}, {width: 1077, height: 800})).toEqual([{width: 1077, height: 800}]);
        expect(downscaleSteps({width: 1000, height: 800}, {width: 600, height: 480})).toEqual([{width: 600, height: 480}]);
    });
});

describe("extensionFor", () => {
    it("maps encoder output types", () => {
        expect(extensionFor("image/webp")).toBe("webp");
        expect(extensionFor("image/png")).toBe("png");
        expect(() => extensionFor("image/gif")).toThrow();
    });
});

// jsdom has no canvas: stub createImageBitmap + OffscreenCanvas and check what gets drawn/encoded.
describe("resizeImageVariants", () => {
    afterEach(() => vi.unstubAllGlobals());

    function stubCanvas(encodedType = "image/webp") {
        const draws: string[] = [];
        const encodes: {type?: string; quality?: number; size: string}[] = [];
        const close = vi.fn();
        class FakeCanvas {
            width: number;
            height: number;
            constructor(width: number, height: number) {
                this.width = width;
                this.height = height;
            }
            getContext() {
                return {
                    drawImage: (src: {width: number; height: number}, _x: number, _y: number, w: number, h: number) =>
                        draws.push(`${src.width}×${src.height}→${w}×${h}`),
                };
            }
            async convertToBlob(options: {type?: string; quality?: number}) {
                encodes.push({...options, size: `${this.width}×${this.height}`});
                return new Blob(["x"], {type: encodedType});
            }
        }
        vi.stubGlobal("OffscreenCanvas", FakeCanvas);
        vi.stubGlobal("createImageBitmap", vi.fn(async () => ({width: 1077, height: 800, close})));
        return {draws, encodes, close};
    }

    it("decodes once and encodes each variant as WebP at its quality", async () => {
        const {draws, encodes, close} = stubCanvas();
        const [full, thumb] = await resizeImageVariants(new Blob(["png"]), [
            {name: "full", maxWidth: 1600, quality: 0.82},
            {name: "thumb", maxWidth: 400, quality: 0.75},
        ]);
        expect(createImageBitmap).toHaveBeenCalledTimes(1);
        expect(full).toMatchObject({name: "full", width: 1077, height: 800, ext: "webp", type: "image/webp"});
        expect(thumb).toMatchObject({name: "thumb", width: 400, height: 297, ext: "webp"});
        expect(draws).toEqual(["1077×800→1077×800", "1077×800→539×400", "539×400→400×297"]);
        expect(encodes).toEqual([
            {type: "image/webp", quality: 0.82, size: "1077×800"},
            {type: "image/webp", quality: 0.75, size: "400×297"},
        ]);
        expect(close).toHaveBeenCalled();
    });

    it("reports PNG when the browser can't encode WebP", async () => {
        stubCanvas("image/png");
        await expect(resizeImage(new Blob(["png"]), {maxWidth: 400})).resolves.toMatchObject({ext: "png", type: "image/png"});
    });
});
