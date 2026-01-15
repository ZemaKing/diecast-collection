import {useMemo, useState} from "react";

import {Header} from "./components/Header/Header.tsx";
import {ModelCard} from "./components/ModelCard/ModelCard.tsx";
import type {Filters} from "./components/Sidebar/Sidebar.tsx";
import {Sidebar} from "./components/Sidebar/Sidebar.tsx";
import {DetailsModal} from "./components/DetailsModal/DetailsModal.tsx";

import rawModels from "./data/models.json";
import type {DiecastModel} from "./types";

import "./styles/theme.css";
import "./styles.css";

const models = rawModels as DiecastModel[];

export default function App() {
    const [filters, setFilters] = useState<Filters>({brand: "All", manufacturer: "All", category: "All", color: "All"});

    const [selectedModel, setSelectedModel] = useState<DiecastModel | null>(null);

    const openModal = (model: DiecastModel) => setSelectedModel(model);
    const closeModal = () => setSelectedModel(null);

    const filteredModels = useMemo(() => {
        const {brand, manufacturer, category, color} = filters;

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
    }, [filters]);

    return (
        <div className="appShell">
            <Header title="ZemaKing Diecast Collection" count={models.length}/>

            <div className="body">
                <Sidebar
                    models={models}
                    onFiltersChange={setFilters}
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
