import {describe, expect, it} from "vitest";

import type {ModelImage} from "../services/types.ts";

import {
    counterLabel,
    displayableImages,
    fullSrc,
    imageAlt,
    neighborIndexes,
    primaryIndex,
    swipeDirection,
    thumbSrc,
    wrapIndex,
} from "./gallery.ts";

function image(overrides: Partial<ModelImage> = {}): ModelImage {
    return {id: "i", position: 0, isPrimary: false, url: "full.png", thumbUrl: "thumb.png", width: null, height: null, alt: null, ...overrides};
}

describe("displayableImages", () => {
    it("drops rows with no URL at all, keeping order", () => {
        const images = [image({id: "a"}), image({id: "b", url: null, thumbUrl: null}), image({id: "c", url: null})];
        expect(displayableImages(images).map((i) => i.id)).toEqual(["a", "c"]);
    });
});

describe("primaryIndex", () => {
    it("finds the primary photo wherever it is", () => {
        expect(primaryIndex([image(), image({isPrimary: true}), image()])).toBe(1);
    });

    it("falls back to the first photo when none is marked primary (or there are none)", () => {
        expect(primaryIndex([image(), image()])).toBe(0);
        expect(primaryIndex([])).toBe(0);
    });
});

describe("wrapIndex / neighborIndexes", () => {
    it("wraps both ways", () => {
        expect(wrapIndex(-1, 5)).toBe(4);
        expect(wrapIndex(5, 5)).toBe(0);
        expect(wrapIndex(7, 5)).toBe(2);
        expect(wrapIndex(3, 0)).toBe(0);
    });

    it("returns both neighbours, one when they coincide, none for a single photo", () => {
        expect(neighborIndexes(0, 5)).toEqual([1, 4]);
        expect(neighborIndexes(4, 5)).toEqual([0, 3]);
        expect(neighborIndexes(0, 2)).toEqual([1]);
        expect(neighborIndexes(0, 1)).toEqual([]);
        expect(neighborIndexes(0, 0)).toEqual([]);
    });
});

describe("fullSrc / thumbSrc", () => {
    it("prefers the right size and falls back to the other", () => {
        expect(fullSrc(image())).toBe("full.png");
        expect(thumbSrc(image())).toBe("thumb.png");
        expect(fullSrc(image({url: null}))).toBe("thumb.png");
        expect(thumbSrc(image({thumbUrl: null}))).toBe("full.png");
        expect(fullSrc(image({url: null, thumbUrl: null}))).toBeNull();
    });
});

describe("counterLabel", () => {
    it("is 1-based", () => {
        expect(counterLabel(0, 8)).toBe("1 / 8");
        expect(counterLabel(7, 8)).toBe("8 / 8");
    });
});

describe("imageAlt", () => {
    it("uses owner alt text when present", () => {
        expect(imageAlt(image({alt: "Rear view"}), "Chevrolet Corvette", 1, 3)).toBe("Rear view");
    });

    it("describes the photo from the model otherwise, with its position only when there are several", () => {
        expect(imageAlt(image(), "Chevrolet Corvette (2020)", 1, 3)).toBe("Chevrolet Corvette (2020), photo 2 of 3");
        expect(imageAlt(image(), "Chevrolet Corvette (2020)", 0, 1)).toBe("Chevrolet Corvette (2020)");
    });
});

describe("swipeDirection", () => {
    it("left swipe → next, right swipe → prev", () => {
        expect(swipeDirection(-80, 5)).toBe("next");
        expect(swipeDirection(80, -5)).toBe("prev");
    });

    it("ignores short moves and mostly-vertical ones (scrolling, taps)", () => {
        expect(swipeDirection(-20, 0)).toBeNull();
        expect(swipeDirection(-60, 70)).toBeNull();
        expect(swipeDirection(0, 0)).toBeNull();
    });
});
