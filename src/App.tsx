import {useMemo, useState} from "react";
import rawModels from "./data/models.json";
import type {DiecastModel} from "./types";
import "./styles.css";

const models = rawModels as DiecastModel[];

function uniqSorted(values: string[]) {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function getFilterOptions(items: DiecastModel[]) {
    return {
        brands: uniqSorted(items.map((x) => x.brand)),
        manufacturers: uniqSorted(items.map((x) => x.manufacturer)),
        colors: uniqSorted(items.flatMap((x) => x.color)),
    };
}

function ModelCard({model}: { model: DiecastModel }) {
    return (
        <div className="card">
            <div className="cardTitle">{model.name}</div>
            <div className="cardMeta">
                <span>{model.brand}</span>
                <span>•</span>
                <span>{model.year}</span>
                <span>•</span>
                <span>{model.manufacturer}</span>
                <span>•</span>
                <span>{model.color.join(' - ')}</span>
            </div>
        </div>
    );
}

export default function App() {
    const [brand, setBrand] = useState<string>("All");
    const [manufacturer, setManufacturer] = useState<string>("All");
    const [color, setColor] = useState<string>("All");

    const options = useMemo(() => getFilterOptions(models), []);

    const filtered = useMemo(() => {
        return models
            .filter((m) => (brand === "All" ? true : m.brand === brand))
            .filter((m) =>
                manufacturer === "All" ? true : m.manufacturer === manufacturer
            )
            .filter((m) =>
                color === "All" ? true : m.color.includes(color)
            )
            .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
    }, [brand, manufacturer, color]);

    const clearFilters = () => {
        setBrand("All");
        setManufacturer("All");
        setColor("All");
    };

    return (
        <div className="appShell">
            <header className="topHeader">
                <div className="logo">Diecast Collection</div>
                <div className="headerRight">
                    <div className="countPill">{filtered.length} models</div>
                </div>
            </header>

            <div className="body">
                <aside className="sidebar">
                    <div className="sidebarTitle">Filters</div>

                    <label className="field">
                        <span className="fieldLabel">Brand</span>
                        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                            <option value="All">All</option>
                            {options.brands.map((x) => (
                                <option key={x} value={x}>
                                    {x}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span className="fieldLabel">Manufacturer</span>
                        <select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}>
                            <option value="All">All</option>
                            {options.manufacturers.map((x) => (
                                <option key={x} value={x}>
                                    {x}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span className="fieldLabel">Color</span>
                        <select value={color} onChange={(e) => setColor(e.target.value)}>
                            <option value="All">All</option>
                            {options.colors.map((x) => (
                                <option key={x} value={x}>
                                    {x}
                                </option>
                            ))}
                        </select>
                    </label>

                    <button className="btn" onClick={clearFilters}>
                        Clear
                    </button>

                    <div className="hint">
                        Tip: add more models in <code>src/data/models.json</code>
                    </div>
                </aside>

                <main className="main">
                    <div className="mainTitle">Models</div>

                    {filtered.length === 0 ? (
                        <div className="emptyState">No models match the selected filters.</div>
                    ) : (
                        <div className="list">
                            {filtered.map((m) => (
                                <ModelCard key={m.id} model={m}/>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
