import {useEffect, useMemo, useState} from "react";

import type {DiecastModel} from "../../types.ts";

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
    models: DiecastModel[];
    filteredCount: number;
    onClear?: () => void;
    onFiltersChange: (filters: Filters) => void;
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

export function Sidebar({models, filteredCount, onFiltersChange, onClear}: SidebarProps) {
    const options = useMemo(() => getFilterOptions(models), [models]);

    const [brand, setBrand] = useState<string>("All");
    const [manufacturer, setManufacturer] = useState<string>("All");
    const [category, setCategory] = useState<string>("All");
    const [color, setColor] = useState<string>("All");

    useEffect(() => {
        onFiltersChange({brand, manufacturer, category, color});
    }, [brand, manufacturer, category, color, onFiltersChange]);

    const clearFilters = () => {
        setBrand("All");
        setManufacturer("All");
        setCategory("All");
        setColor("All");
        onClear?.();
    };

    return (
        <aside className="sidebar">
            <img src="/logo.png" alt="ZemaKing logo" className="siteLogo"/>

            <div className="sidebarTopRow">
                <div className="sidebarTitle">Filters</div>
                <div className="countPill countPill--small">{filteredCount} models</div>
            </div>

            <div className="filters">
                <label className="field">
                    <span className="fieldLabel">Brand</span>
                    <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                        <option value="All">All</option>
                        {options.brands.map(brand => (
                            <option key={brand} value={brand}>{brand}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Manufacturer</span>
                    <select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}>
                        <option value="All">All</option>
                        {options.manufacturers.map(manufacturer => (
                            <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Category</span>
                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="All">All</option>
                        {options.categories.map(category => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                </label>

                <label className="field">
                    <span className="fieldLabel">Color</span>
                    <select value={color} onChange={(e) => setColor(e.target.value)}>
                        <option value="All">All</option>
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