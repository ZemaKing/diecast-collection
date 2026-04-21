import {useEffect, useMemo, useState} from "react";
import "./collection-page.css";

import {Header} from "../../components/Header/Header";
import {Sidebar} from "../../components/Sidebar/Sidebar";
import {ModelCard} from "../../components/ModelCard/ModelCard";
import {DetailsModal} from "../../components/DetailsModal/DetailsModal";

import carModelsData from "../../data/car-models.json";
import truckModelsData from "../../data/truck-models.json";

import type {DiecastModel, DiecastType} from "../../types.ts";

type CollectionPageProps = {
    type: DiecastType;
};

export function CollectionPage({ type }: CollectionPageProps) {
    const [filters, setFilters] = useState({});
    const [selectedModel, setSelectedModel] = useState<DiecastModel | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);

    const models = useMemo(() => {
        return type === "cars" ? carModelsData as DiecastModel[] : truckModelsData as DiecastModel[];
    }, [type]);

    const filteredModels = useMemo(() => {
        return models.filter((model: DiecastModel) => {
            if (filters && typeof filters === "object") {
                const currentFilters = filters as Record<string, string[]>;
                const isAll = (arr?: string[]) => !arr || arr.length === 0 || arr.includes("All");

                if (!isAll(currentFilters.brand) && !currentFilters.brand.includes(model.brand)) {
                    return false;
                }

                if (!isAll(currentFilters.manufacturer) && !currentFilters.manufacturer.includes(model.manufacturer)) {
                    return false;
                }

                if (!isAll(currentFilters.category) && !currentFilters.category.includes(model.category)) {
                    return false;
                }

                const colorFilterArr = Array.isArray(currentFilters.color)
                  ? currentFilters.color
                  : currentFilters.color
                    ? [currentFilters.color]
                    : [];

                if (!isAll(colorFilterArr)) {
                    const modelColors = Array.isArray(model.color) ? model.color : [model.color];
                    if (!colorFilterArr.some((color) => modelColors.includes(color))) {
                        return false;
                    }
                }
            }

            return true;
        });
    }, [models, filters]);

    useEffect(() => {
        setSelectedModel(null);
        setFilters({});
        window.scrollTo({ top: 0, behavior: "auto" });
    }, [type]);

    useEffect(() => {
        const onScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };

        window.addEventListener("scroll", onScroll);

        return () => {
            window.removeEventListener("scroll", onScroll);
        };
    }, []);

    const openModal = (model: DiecastModel) => {
        setSelectedModel(model);
    };

    const closeModal = () => {
        setSelectedModel(null);
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div className="layout">
            <Header title="ZemaKing Diecast Collection" count={models.length} />

            <div className="content">
                <Sidebar
                    type={type}
                    models={models}
                    onFiltersChange={setFilters}
                    filteredCount={filteredModels.length}
                />

                <main className="main">
                    {filteredModels.length === 0 ? (
                        <div className="contentEmpty">No models match the selected filters.</div>
                    ) : (
                        <div className="modelGrid">
                            {filteredModels.map((m: DiecastModel) => (
                                <ModelCard key={m.id} model={m} onClick={() => openModal(m)} />
                            ))}
                        </div>
                    )}

                    <DetailsModal
                        model={selectedModel}
                        isOpen={!!selectedModel}
                        onClose={closeModal}
                    />
                </main>
            </div>

            {showScrollTop && (
                <button className="scrollTopButton" onClick={scrollToTop} type="button">
                    ˄
                </button>
            )}
        </div>
    );
}
