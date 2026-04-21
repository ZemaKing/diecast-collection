import {useEffect, useMemo, useState} from "react";
import {useSearchParams} from "react-router-dom";

import type {DiecastModel, DiecastType} from "../../types.ts";

import "./Sidebar.css";

type FilterOptions = {
    brands: string[];
    manufacturers: string[];
    categories: string[];
    colors: string[];
};

export type Filters = {
    brand: string;
    manufacturer: string;
    category: string;
    color: string;
};

type SidebarProps = {
    type: DiecastType;
    models: DiecastModel[];
    filteredCount: number;
    onClear?: () => void;
    onFiltersChange: (filters: Filters) => void;
};

const ALL_VALUE = "All";

const DEFAULT_FILTERS: Filters = {
    brand: ALL_VALUE,
    manufacturer: ALL_VALUE,
    category: ALL_VALUE,
    color: ALL_VALUE,
};

function uniqSorted(values: string[]) {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function getFilterOptions(items: DiecastModel[]): FilterOptions {
    return {
        brands: uniqSorted(items.map((x) => x.brand)),
        manufacturers: uniqSorted(items.map((x) => x.manufacturer)),
        categories: uniqSorted(items.map((x) => x.category)),
        colors: uniqSorted(items.flatMap((x) => x.color)),
    };
}

function getFiltersFromSearchParams(searchParams: URLSearchParams): Filters {
    return {
        brand: searchParams.get("brand") || ALL_VALUE,
        manufacturer: searchParams.get("manufacturer") || ALL_VALUE,
        category: searchParams.get("category") || ALL_VALUE,
        color: searchParams.get("color") || ALL_VALUE,
    };
}

export function Sidebar({type, models, filteredCount, onFiltersChange, onClear}: SidebarProps) {
    const options = useMemo(() => getFilterOptions(models), [models]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [filters, setFilters] = useState<Filters>(() => getFiltersFromSearchParams(searchParams));

    useEffect(() => {
        const nextFilters = getFiltersFromSearchParams(searchParams);

        setFilters((prev) => {
            if (
                prev.brand === nextFilters.brand &&
                prev.manufacturer === nextFilters.manufacturer &&
                prev.category === nextFilters.category &&
                prev.color === nextFilters.color
            ) {
                return prev;
            }

            return nextFilters;
        });
    }, [searchParams]);

    useEffect(() => {
        onFiltersChange(filters);
    }, [filters, onFiltersChange]);

    useEffect(() => {
        const nextSearchParams = new URLSearchParams(searchParams);

        if (filters.brand === ALL_VALUE) {
            nextSearchParams.delete("brand");
        } else {
            nextSearchParams.set("brand", filters.brand);
        }

        if (filters.manufacturer === ALL_VALUE) {
            nextSearchParams.delete("manufacturer");
        } else {
            nextSearchParams.set("manufacturer", filters.manufacturer);
        }

        if (filters.category === ALL_VALUE) {
            nextSearchParams.delete("category");
        } else {
            nextSearchParams.set("category", filters.category);
        }

        if (filters.color === ALL_VALUE) {
            nextSearchParams.delete("color");
        } else {
            nextSearchParams.set("color", filters.color);
        }

        if (nextSearchParams.toString() !== searchParams.toString()) {
            setSearchParams(nextSearchParams, {replace: true});
        }
    }, [filters, searchParams, setSearchParams]);

    const updateFilter = (key: keyof Filters, value: string) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const clearFilters = () => {
        setFilters(DEFAULT_FILTERS);
        onClear?.();
    };

    const logoSrc = type === "cars" ? "/cars-logo.png" : "/trucks-logo.png";

    return (
        <aside className="sidebar">
            <img src={logoSrc} alt="ZemaKing logo" className="siteLogo"/>

            <div className="sidebarTopRow">
                <div className="sidebarTitle">Filters</div>
                <div className="countPill countPill--small">{filteredCount} models</div>
            </div>

            <div className="filters">
                <label className="field">
                    <span className="fieldLabel">Brand</span>
                    <select value={filters.brand} onChange={(e) => updateFilter("brand", e.target.value)}>
                        <option value={ALL_VALUE}>All</option>
                        {options.brands.map((brand) => (
                            <option key={brand} value={brand}>{brand}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Manufacturer</span>
                    <select value={filters.manufacturer} onChange={(e) => updateFilter("manufacturer", e.target.value)}>
                        <option value={ALL_VALUE}>All</option>
                        {options.manufacturers.map((manufacturer) => (
                            <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Category</span>
                    <select value={filters.category} onChange={(e) => updateFilter("category", e.target.value)}>
                        <option value={ALL_VALUE}>All</option>
                        {options.categories.map((category) => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Color</span>
                    <select value={filters.color} onChange={(e) => updateFilter("color", e.target.value)}>
                        <option value={ALL_VALUE}>All</option>
                        {options.colors.map((color) => (
                            <option key={color} value={color}>{color}</option>
                        ))}
                    </select>
                </label>
            </div>

            <button className="clearButton" onClick={clearFilters} type="button">
                Clear
            </button>
        </aside>
    );
}
