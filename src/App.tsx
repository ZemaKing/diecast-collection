import {useEffect, useMemo, useState} from "react";

import {Header} from "./components/Header/Header.tsx";
import {ModelCard} from "./components/ModelCard/ModelCard.tsx";
import {Sidebar} from "./components/Sidebar/Sidebar.tsx";
import {DetailsModal} from "./components/DetailsModal/DetailsModal.tsx";

import carModels from "./data/car-models.json";

import type {Filters} from "./components/Sidebar/Sidebar.tsx";
import type {DiecastModel} from "./types";

import "./App.css";

const models = carModels as DiecastModel[];

export default function App() {
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [filters, setFilters] = useState<Filters>({brand: "All", manufacturer: "All", category: "All", color: "All"});

    const [selectedModel, setSelectedModel] = useState<DiecastModel | null>(null);

    const openModal = (model: DiecastModel) => {
        setSelectedModel(model);
        const url = new URL(window.location.href);
        url.searchParams.set("model", String(model.id));
        window.history.pushState({}, '', url);
    };

    const closeModal = () => {
        setSelectedModel(null);
        const url = new URL(window.location.href);
        url.searchParams.delete("model");
        window.history.pushState({}, '', url.pathname + url.search);
    };

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

    useEffect(() => {
        const onScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };

        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        const url = new URL(window.location.href);
        const modelId = url.searchParams.get("model");
        if (modelId) {
            const found = models.find(m => String(m.id) === modelId);
            if (found) {
                setTimeout(() => setSelectedModel(found), 0);
            }
        }

        const onPopState = () => {
            const url = new URL(window.location.href);
            const modelId = url.searchParams.get("model");
            if (modelId) {
                const found = models.find(m => String(m.id) === modelId);
                setSelectedModel(found || null);
            } else {
                setSelectedModel(null);
            }
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div className="layout">
            <Header title="ZemaKing Diecast Collection" count={models.length}/>

            <div className="content">
                <Sidebar
                    models={models}
                    onFiltersChange={setFilters}
                    filteredCount={filteredModels.length}
                />

                <main className="main">
                    <div className="mainTitle">Models</div>

                    {filteredModels.length === 0 ? (
                        <div className="contentEmpty">No models match the selected filters.</div>
                    ) : (
                        <div className="modelGrid">
                            {filteredModels.map((m) => (
                                <ModelCard key={m.id} model={m} onClick={() => openModal(m)} />
                            ))}
                        </div>
                    )}

                    <DetailsModal model={selectedModel} isOpen={!!selectedModel} onClose={closeModal}/>
                </main>
            </div>

            {showScrollTop && <button className="scrollTopButton" onClick={scrollToTop}>˄</button>}
        </div>
    );
}
