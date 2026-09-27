import type {DiecastModel} from "../types.ts";

export const ALL_VALUE = "All";

export type Filters = {
    brand: string;
    manufacturer: string;
    category: string;
    color: string;
};

export type FilterOptions = {
    brands: string[];
    manufacturers: string[];
    categories: string[];
    colors: string[];
};

export const DEFAULT_FILTERS: Filters = {
    brand: ALL_VALUE,
    manufacturer: ALL_VALUE,
    category: ALL_VALUE,
    color: ALL_VALUE,
};

export function uniqSorted(values: string[]) {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

// `color` is typed as an array, but the data is force-cast from JSON, so tolerate a bare string.
export function getModelColors(model: DiecastModel): string[] {
    return Array.isArray(model.color) ? model.color : [model.color];
}

export function getFilterOptions(items: DiecastModel[]): FilterOptions {
    return {
        brands: uniqSorted(items.map((x) => x.brand)),
        manufacturers: uniqSorted(items.map((x) => x.manufacturer)),
        categories: uniqSorted(items.map((x) => x.category)),
        colors: uniqSorted(items.flatMap((x) => x.color)),
    };
}

export function matchesFilters(model: DiecastModel, filters: Filters): boolean {
    const brandMatch =
        filters.brand === ALL_VALUE || model.brand === filters.brand;

    const manufacturerMatch =
        filters.manufacturer === ALL_VALUE || model.manufacturer === filters.manufacturer;

    const categoryMatch =
        filters.category === ALL_VALUE || model.category === filters.category;

    const colorMatch =
        filters.color === ALL_VALUE || getModelColors(model).includes(filters.color);

    return brandMatch && manufacturerMatch && categoryMatch && colorMatch;
}

export function filterModels(models: DiecastModel[], filters: Filters): DiecastModel[] {
    return models.filter((model) => matchesFilters(model, filters));
}

export function findModelById(models: DiecastModel[], id: string): DiecastModel | undefined {
    return models.find((m) => String(m.id) === String(id));
}
