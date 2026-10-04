import {afterEach, describe, expect, it} from "vitest";
import {act, cleanup, renderHook} from "@testing-library/react";
import type {ReactNode} from "react";
import {MemoryRouter, useLocation} from "react-router-dom";

import {useCollectionQuery} from "./useCollectionQuery.ts";

// The collection's query state lives only in the URL (Phase 13/15). Phase 35: the hook itself,
// in a router — derived state, defaults, and what each action writes back.
function setup(initial: string) {
    const wrapper = ({children}: {children: ReactNode}) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
    return renderHook(() => ({query: useCollectionQuery(), location: useLocation()}), {wrapper});
}

afterEach(cleanup);

describe("useCollectionQuery", () => {
    it("reads filters, search and sort from the URL, normalizing legacy values", () => {
        const {result} = setup("/?brand=Ford&brand=bmw&color=MULTI&q=gt&sort=year-desc");
        expect(result.current.query.filters).toEqual({brands: ["ford", "bmw"], manufacturers: [], categories: [], colors: ["multi"]});
        expect(result.current.query.query).toBe("gt");
        expect(result.current.query.sort).toBe("year-desc");
    });

    it("defaults the sort to Recently added, or Relevance while searching", () => {
        expect(setup("/").result.current.query.sort).toBe("added-desc");
        expect(setup("/?q=porsche").result.current.query.sort).toBe("relevance");
        expect(setup("/?q=%20%20").result.current.query.sort).toBe("added-desc");
    });

    it("toggles a filter value on and off in the URL, keeping other params", () => {
        const {result} = setup("/?q=gt&sort=name-asc");
        act(() => result.current.query.toggleFilter("brands", "porsche"));
        expect(result.current.location.search).toBe("?q=gt&sort=name-asc&brand=porsche");
        act(() => result.current.query.toggleFilter("brands", "audi"));
        expect(result.current.query.filters.brands).toEqual(["audi", "porsche"]);
        act(() => result.current.query.toggleFilter("brands", "porsche"));
        expect(result.current.query.filters.brands).toEqual(["audi"]);
    });

    it("clears filters without touching search or sort, and clears search on its own", () => {
        const {result} = setup("/?brand=ford&category=rally&q=escort&sort=year-asc");
        act(() => result.current.query.clearFilters());
        expect(result.current.location.search).toBe("?q=escort&sort=year-asc");
        act(() => result.current.query.clearQuery());
        expect(result.current.location.search).toBe("?sort=year-asc");
    });

    it("writes the chosen sort", () => {
        const {result} = setup("/?brand=ford");
        act(() => result.current.query.setSort("manufacturer"));
        expect(result.current.query.sort).toBe("manufacturer");
        expect(result.current.location.search).toContain("sort=manufacturer");
        expect(result.current.location.search).toContain("brand=ford");
    });
});
