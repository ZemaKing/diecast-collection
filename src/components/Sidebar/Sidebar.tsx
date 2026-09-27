import {useEffect, useMemo, useState} from "react";
import {useSearchParams} from "react-router-dom";

import type {DiecastModel, DiecastType} from "../../types.ts";
import {ALL_VALUE, DEFAULT_FILTERS, getFilterOptions, type Filters} from "../../utils/collection-filters.ts";
import {applyFiltersToSearchParams, filtersEqual, getFiltersFromSearchParams} from "../../utils/url-params.ts";

import "./Sidebar.css";

type SidebarProps = {
    type: DiecastType;
    models: DiecastModel[];
    filteredCount: number;
    onClear?: () => void;
    onFiltersChange: (filters: Filters) => void;
};

export function Sidebar({type, models, filteredCount, onFiltersChange, onClear}: SidebarProps) {
    const options = useMemo(() => getFilterOptions(models), [models]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [filters, setFilters] = useState<Filters>(() => getFiltersFromSearchParams(searchParams));

    useEffect(() => {
        const nextFilters = getFiltersFromSearchParams(searchParams);

        // Legacy URL→state sync; replaced by URL-as-source-of-truth in ROADMAP Phase 13.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFilters((prev) => filtersEqual(prev, nextFilters) ? prev : nextFilters);
    }, [searchParams]);

    useEffect(() => {
        onFiltersChange(filters);
    }, [filters, onFiltersChange]);

    useEffect(() => {
        const nextSearchParams = applyFiltersToSearchParams(searchParams, filters);

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

    return (
        <aside className="sidebar">
            <div className="siteBrand">
                <img src="/favicon.svg" alt="" className="siteBrandIcon" width={48} height={48}/>
                <div className="siteBrandText">
                    <span className="siteBrandName">ZemaKing</span>
                    <span className="siteBrandTagline">Diecast {type === "cars" ? "Car" : "Truck"} Collection</span>
                </div>
            </div>

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
