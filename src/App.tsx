import {useMemo, useState} from "react";

import {Header} from "./components/Header/Header.tsx";
import {ModelCard} from "./components/ModelCard/ModelCard.tsx";
import {Sidebar} from "./components/Sidebar/Sidebar.tsx";
import {DetailsModal} from "./components/DetailsModal/DetailsModal.tsx";

import rawModels from "./data/models.json";

import type {DiecastModel} from "./types";

import "./styles/theme.css";
import "./styles.css";

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

export default function App() {
    const [brand, setBrand] = useState<string>("All");
    const [manufacturer, setManufacturer] = useState<string>("All");
    const [category, setCategory] = useState<string>("All");
    const [color, setColor] = useState<string>("All");

    const [selectedModel, setSelectedModel] = useState<DiecastModel | null>(null);

    const openModal = (model: DiecastModel) => setSelectedModel(model);
    const closeModal = () => setSelectedModel(null);

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
            <Header
                title="ZemaKing Diecast Collection"
                count={models.length}
            />

            <div className="body">
                <Sidebar
                    brand={brand}
                    manufacturer={manufacturer}
                    category={category}
                    color={color}
                    options={options}
                    onBrandChange={setBrand}
                    onManufacturerChange={setManufacturer}
                    onCategoryChange={setCategory}
                    onColorChange={setColor}
                    onClear={clearFilters}
                    filteredCount={filteredModels.length}
                />

                <main className="main">
                    <div className="mainTitle">Models</div>

                    {filteredModels.length === 0 ? (
                        <div className="emptyState">No models match the selected filters.</div>
                    ) : (
                        <div className="list">
                            {filteredModels.map((m) => (
                                <ModelCard key={m.id} model={m} onClick={() => openModal(m)} />
                            ))}
                        </div>
                    )}

                    <DetailsModal model={selectedModel} isOpen={!!selectedModel} onClose={closeModal}/>
                </main>
            </div>
        </div>
    );
}
