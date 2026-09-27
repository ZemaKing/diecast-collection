import {ALL_VALUE, type Filters} from "./collection-filters.ts";

const FILTER_KEYS: (keyof Filters)[] = ["brand", "manufacturer", "category", "color"];

export function getFiltersFromSearchParams(searchParams: URLSearchParams): Filters {
    return {
        brand: searchParams.get("brand") || ALL_VALUE,
        manufacturer: searchParams.get("manufacturer") || ALL_VALUE,
        category: searchParams.get("category") || ALL_VALUE,
        color: searchParams.get("color") || ALL_VALUE,
    };
}

export function filtersEqual(a: Filters, b: Filters): boolean {
    return FILTER_KEYS.every((key) => a[key] === b[key]);
}

// Returns a copy of `searchParams` with the filter params written in; all other params are preserved.
export function applyFiltersToSearchParams(searchParams: URLSearchParams, filters: Filters): URLSearchParams {
    const nextSearchParams = new URLSearchParams(searchParams);

    for (const key of FILTER_KEYS) {
        if (filters[key] === ALL_VALUE) {
            nextSearchParams.delete(key);
        } else {
            nextSearchParams.set(key, filters[key]);
        }
    }

    return nextSearchParams;
}

export function withModelParam(searchParams: URLSearchParams, modelId: string): URLSearchParams {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("model", String(modelId));
    return nextSearchParams;
}

export function withoutModelParam(searchParams: URLSearchParams): URLSearchParams {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("model");
    return nextSearchParams;
}
