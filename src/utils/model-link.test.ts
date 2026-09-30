import {describe, expect, it} from "vitest";

import {
    collectionPath,
    editModelPath,
    getLegacyModelRedirect,
    modelPath,
    NEW_MODEL_PATH,
    readAdminNotice,
    readCollectionSearch,
    readFocusModel,
} from "./model-link.ts";

describe("modelPath", () => {
    it("builds the details route, encoding the slug", () => {
        expect(modelPath("ford-gt-2006-ixo-blue")).toBe("/models/ford-gt-2006-ixo-blue");
        expect(modelPath("a b/c")).toBe("/models/a%20b%2Fc");
    });
});

describe("readCollectionSearch", () => {
    it("accepts a query string or an empty string", () => {
        expect(readCollectionSearch({collectionSearch: "?brand=ford&q=gt"})).toBe("?brand=ford&q=gt");
        expect(readCollectionSearch({collectionSearch: ""})).toBe("");
    });

    it("rejects anything else — history state is untrusted", () => {
        expect(readCollectionSearch(null)).toBe("");
        expect(readCollectionSearch(undefined)).toBe("");
        expect(readCollectionSearch("?brand=ford")).toBe("");
        expect(readCollectionSearch({collectionSearch: 42})).toBe("");
        expect(readCollectionSearch({collectionSearch: "//evil.example"})).toBe("");
        expect(readCollectionSearch({collectionSearch: "https://evil.example"})).toBe("");
    });
});

describe("readFocusModel", () => {
    it("returns a non-empty string slug, null otherwise", () => {
        expect(readFocusModel({focusModel: "ford-gt"})).toBe("ford-gt");
        expect(readFocusModel({focusModel: ""})).toBeNull();
        expect(readFocusModel({focusModel: 1})).toBeNull();
        expect(readFocusModel(null)).toBeNull();
    });
});

describe("collectionPath", () => {
    it("appends the query string to /", () => {
        expect(collectionPath("?brand=ford")).toBe("/?brand=ford");
        expect(collectionPath("")).toBe("/");
        expect(collectionPath("?")).toBe("/");
    });
});

describe("getLegacyModelRedirect", () => {
    it("maps ?model=<id> to /models/<id>", () => {
        expect(getLegacyModelRedirect(new URLSearchParams("model=mazda-rx-7-fd-1993-deagostini-red"))).toEqual({
            to: "/models/mazda-rx-7-fd-1993-deagostini-red",
            state: {collectionSearch: ""},
        });
    });

    it("keeps the other params as the way back to the collection", () => {
        const redirect = getLegacyModelRedirect(new URLSearchParams("brand=Ford&model=ford-gt&q=gt"));
        expect(redirect?.to).toBe("/models/ford-gt");
        expect(redirect?.state).toEqual({collectionSearch: "?brand=Ford&q=gt"});
    });

    it("is null without a (non-blank) model param", () => {
        expect(getLegacyModelRedirect(new URLSearchParams("brand=ford"))).toBeNull();
        expect(getLegacyModelRedirect(new URLSearchParams("model="))).toBeNull();
        expect(getLegacyModelRedirect(new URLSearchParams("model=%20%20"))).toBeNull();
    });

    it("never mutates its input", () => {
        const params = new URLSearchParams("model=x&brand=ford");
        getLegacyModelRedirect(params);
        expect(params.toString()).toBe("model=x&brand=ford");
    });
});

describe("admin model paths & notices (Phase 25)", () => {
    it("builds the form's URLs", () => {
        expect(NEW_MODEL_PATH).toBe("/admin/models/new");
        expect(editModelPath("ferrari-499p-2023-burago-red")).toBe("/admin/models/ferrari-499p-2023-burago-red/edit");
    });

    it("reads a notice only when it's a non-empty string", () => {
        expect(readAdminNotice({adminNotice: "Changes saved."})).toBe("Changes saved.");
        expect(readAdminNotice({adminNotice: ""})).toBeNull();
        expect(readAdminNotice({adminNotice: 42})).toBeNull();
        expect(readAdminNotice(null)).toBeNull();
    });
});
