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

function getParamValue(searchParams: URLSearchParams, key: keyof Filters): string {
    return searchParams.get(key) || ALL_VALUE;
}

export function Sidebar({type, models, filteredCount, onFiltersChange, onClear}: SidebarProps) {
    const options = useMemo(() => getFilterOptions(models), [models]);
    const [searchParams, setSearchParams] = useSearchParams();

    const [brand, setBrand] = useState<string>(() => getParamValue(searchParams, "brand"));
    const [manufacturer, setManufacturer] = useState<string>(() => getParamValue(searchParams, "manufacturer"));
    const [category, setCategory] = useState<string>(() => getParamValue(searchParams, "category"));
    const [color, setColor] = useState<string>(() => getParamValue(searchParams, "color"));

    useEffect(() => {
        setBrand(getParamValue(searchParams, "brand"));
        setManufacturer(getParamValue(searchParams, "manufacturer"));
        setCategory(getParamValue(searchParams, "category"));
        setColor(getParamValue(searchParams, "color"));
    }, [searchParams]);

    useEffect(() => {
        const filters = {brand, manufacturer, category, color};

        onFiltersChange(filters);

        const nextSearchParams = new URLSearchParams(searchParams);

        (Object.entries(filters) as [keyof Filters, string][]).forEach(([key, value]) => {
            if (value === ALL_VALUE) {
                nextSearchParams.delete(key);
            } else {
                nextSearchParams.set(key, value);
            }
        });

        if (nextSearchParams.toString() !== searchParams.toString()) {
            setSearchParams(nextSearchParams, {replace: true});
        }
    }, [brand, manufacturer, category, color, onFiltersChange, searchParams, setSearchParams]);

    const clearFilters = () => {
        setBrand(ALL_VALUE);
        setManufacturer(ALL_VALUE);
        setCategory(ALL_VALUE);
        setColor(ALL_VALUE);
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
                    <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                        <option value={ALL_VALUE}>All</option>
                        {options.brands.map(brand => (
                            <option key={brand} value={brand}>{brand}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Manufacturer</span>
                    <select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}>
                        <option value={ALL_VALUE}>All</option>
                        {options.manufacturers.map(manufacturer => (
                            <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Category</span>
                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value={ALL_VALUE}>All</option>
                        {options.categories.map(category => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Color</span>
                    <select value={color} onChange={(e) => setColor(e.target.value)}>
                        <option value={ALL_VALUE}>All</option>
                        {options.colors.map(color => (
                            <option key={color} value={color}>{color}</option>
                        ))}
                    </select>
                </label>
            </div>

            <button className="clearButton" onClick={clearFilters}>Clear</button>
        </aside>
    );
}