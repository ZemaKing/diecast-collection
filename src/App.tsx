import {useMemo, useState} from "react";
import rawModels from "./data/models.json";
import type {DiecastModel} from "./types";
import "./styles.css";
import {ColorCircle} from "./components/ColorCircle/ColorCircle.tsx";
import {CategoryLabel} from "./components/CategoryLabel/CategoryLabel.tsx";

const models = rawModels as DiecastModel[];

function uniqSorted(values: string[]) {
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function getFilterOptions(items: DiecastModel[]) {
    return {
        brands: uniqSorted(items.map((x) => x.brand)),
        manufacturers: uniqSorted(items.map((x) => x.manufacturer)),
        categories: uniqSorted(items.map((x) => x.category)),
        colors: uniqSorted(items.flatMap((x) => x.color)),
    };
}

function ModelCard({model}: { model: DiecastModel }) {
    return (
        <div className="card">
            <div className="thumb">
                <img
                    src={model.thumbnail}
                    alt={`${model.name} (${model.year})`}
                    loading="lazy"
                    decoding="async"
                />

                {(model.carNumber !== undefined || !!model.carDriver) && (
                    <div className="carDetails">
                        <div className="carNumber">
                            {model.carNumber !== undefined && (
                                <div className="carNumberWrapper">
                                    № {model.carNumber}
                                </div>
                            )}
                        </div>
                        {model.carDriver && (
                            <div className="carDriver">
                                <img className="carDriverLogo" src="/wheel.svg" alt="wheel"/>
                            {model.carDriver}
                        </div>
                        )}
                    </div>
                )}
            </div>
            <div className="cardTitle">
                {model.name}
                {model.hex && <ColorCircle hex={model.hex}/>}
            </div>
            <div className="cardMeta">
                <span>{model.brand}</span>
                <span>•</span>
                <span>{model.year}</span>
                <span>•</span>
                <span>{model.manufacturer}</span>
                <span>•</span>
                <CategoryLabel category={model.category} />
            </div>
        </div>
    );
}

export default function App() {
    const [brand, setBrand] = useState<string>("All");
    const [manufacturer, setManufacturer] = useState<string>("All");
    const [category, setCategory] = useState<string>("All");
    const [color, setColor] = useState<string>("All");

    const options = useMemo(() => getFilterOptions(models), []);

    const filteredModels = useMemo(() => {
        return models
            .filter((m) => brand === "All" || m.brand === brand)
            .filter((m) => manufacturer === "All" || m.manufacturer === manufacturer)
            .filter((m) => category === "All" || m.category === category)
            .filter((m) => color === "All" || m.color.includes(color))
            .sort(
                (a, b) =>
                    a.name.localeCompare(b.name, undefined, {sensitivity: "base"}) ||
                    b.year - a.year
            );
    }, [brand, manufacturer, category, color]);


    const clearFilters = () => {
        setBrand("All");
        setManufacturer("All");
        setCategory("All");
        setColor("All");
    };

    return (
        <div className="appShell">
            <header className="topHeader">
                <div className="logo">Diecast Collection</div>
                <div className="headerRight">
                    <div className="countPill">{filteredModels.length} models</div>
                </div>
            </header>

            <div className="body">
                <aside className="sidebar">
                    <img
                        src="/logo.png"
                        alt="ZemaKing logo"
                        className="siteLogo"
                    />

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
                                <option key={x} value={x}>{x}</option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span className="fieldLabel">Category</span>
                        <select value={category} onChange={(e) => setCategory(e.target.value)}>
                            <option value="All">All</option>
                            {options.categories.map((x) => (
                                <option key={x} value={x}>{x}</option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span className="fieldLabel">Color</span>
                        <select value={color} onChange={(e) => setColor(e.target.value)}>
                            <option value="All">All</option>
                            {options.colors.map((x) => (
                                <option key={x} value={x}>{x}</option>
                            ))}
                        </select>
                    </label>

                    <button className="btn" onClick={clearFilters}>
                        Clear
                    </button>
                </aside>

                <main className="main">
                    <div className="mainTitle">Models</div>

                    {filteredModels.length === 0 ? (
                        <div className="emptyState">No models match the selected filters.</div>
                    ) : (
                        <div className="list">
                            {filteredModels.map((m) => (
                                <ModelCard key={m.id} model={m}/>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
