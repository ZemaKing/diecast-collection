import {describe, expect, it} from "vitest";

import {DEFAULT_VIEW_MODE, VIEW_MODES, VIEW_MODE_STORAGE_KEY, isViewMode, readViewMode, writeViewMode} from "./view-mode.ts";

function memoryStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => void data.set(key, value),
        data,
    };
}

const throwingStorage = {
    getItem: (): string | null => {
        throw new Error("SecurityError");
    },
    setItem: (): void => {
        throw new Error("QuotaExceededError");
    },
};

describe("isViewMode", () => {
    it.each(VIEW_MODES)("accepts %s", (mode) => {
        expect(isViewMode(mode)).toBe(true);
    });

    it.each([null, undefined, "", "Grid", "showcase", "table", 1])("rejects %j", (value) => {
        expect(isViewMode(value)).toBe(false);
    });
});

describe("readViewMode", () => {
    it("defaults to grid when nothing is stored", () => {
        expect(DEFAULT_VIEW_MODE).toBe("grid");
        expect(readViewMode(memoryStorage())).toBe("grid");
    });

    it.each(VIEW_MODES)("restores a stored %s", (mode) => {
        expect(readViewMode(memoryStorage({[VIEW_MODE_STORAGE_KEY]: mode}))).toBe(mode);
    });

    it("ignores an unknown stored value (stale version, hand-edited, deferred showcase)", () => {
        expect(readViewMode(memoryStorage({[VIEW_MODE_STORAGE_KEY]: "showcase"}))).toBe("grid");
    });

    it("falls back to the default when storage is missing or throws", () => {
        expect(readViewMode(null)).toBe("grid");
        expect(readViewMode(undefined)).toBe("grid");
        expect(readViewMode(throwingStorage)).toBe("grid");
    });
});

describe("writeViewMode", () => {
    it("stores the mode under the view-mode key", () => {
        const storage = memoryStorage();
        writeViewMode(storage, "compact");
        expect(storage.data.get(VIEW_MODE_STORAGE_KEY)).toBe("compact");
        expect(readViewMode(storage)).toBe("compact");
    });

    it("never throws when storage is missing or throws", () => {
        expect(() => writeViewMode(null, "list")).not.toThrow();
        expect(() => writeViewMode(throwingStorage, "list")).not.toThrow();
    });
});
