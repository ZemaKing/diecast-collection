import {describe, expect, it} from "vitest";

import {renderPath} from "./paths.ts";

describe("renderPath", () => {
    const pattern = "models/{slug}/{position}-{variant}.{ext}";

    it("fills every placeholder", () => {
        expect(renderPath(pattern, {slug: "ford-gt-2005-ixo-red", position: 0, variant: "thumb", ext: "webp"}))
            .toBe("models/ford-gt-2005-ixo-red/0-thumb.webp");
    });

    it("rejects a missing or empty value", () => {
        expect(() => renderPath(pattern, {slug: "a", position: 0, variant: "full"})).toThrow("{ext}");
        expect(() => renderPath(pattern, {slug: "", position: 0, variant: "full", ext: "webp"})).toThrow("{slug}");
    });

    it("rejects segments that would escape or need encoding", () => {
        const vars = {position: 0, variant: "full", ext: "webp"};
        expect(() => renderPath(pattern, {...vars, slug: ".."})).toThrow("Unsafe");
        expect(() => renderPath(pattern, {...vars, slug: "a b"})).toThrow("Unsafe");
        expect(() => renderPath(pattern, {...vars, slug: "é"})).toThrow("Unsafe");
        expect(() => renderPath("/{slug}", {slug: "a"})).toThrow("Unsafe"); // empty leading segment
    });
});
