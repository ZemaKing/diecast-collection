import {useCallback, useEffect, useMemo, useState} from "react";
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

    const getModelById = useCallback((id: string): DiecastModel | undefined => {
        return models.find((m) => String(m.id) === id);
    }, [models]);

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

    const openModal = useCallback((model: DiecastModel) => {
        setSelectedModel(model);
        const url = new URL(window.location.href);
        url.searchParams.set("model", String(model.id));
        window.history.pushState({}, '', url.pathname + url.search);
    }, []);

    const closeModal = useCallback(() => {
        setSelectedModel(null);
        const url = new URL(window.location.href);
        if (url.searchParams.has("model")) {
            url.searchParams.delete("model");
            window.history.pushState({}, '', url.pathname + url.search);
        }
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    useEffect(() => {
        const url = new URL(window.location.href);
        const modelId = url.searchParams.get("model");
        if (modelId && models.length > 0) {
            const model = getModelById(modelId);
            if (model && (!selectedModel || selectedModel.id !== model.id)) {
                setTimeout(() => {
                    const card = document.getElementById(model.id);
                    if (card) {
                        card.scrollIntoView({behavior: "smooth", block: "center"});
                        const onScrollEnd = () => {
                            setSelectedModel(model);
                            window.removeEventListener('scrollend', onScrollEnd);
                        };
                        window.addEventListener('scrollend', onScrollEnd);
                    } else {
                        setSelectedModel(model);
                    }
                }, 300);
            }
        }
    }, [models, getModelById, selectedModel]);

    useEffect(() => {
        const onPopState = () => {
            const url = new URL(window.location.href);
            const modelId = url.searchParams.get("model");
            if (modelId) {
                const model = getModelById(modelId);
                if (model) {
                    setSelectedModel(model);
                } else {
                    setSelectedModel(null);
                }
            } else {
                setSelectedModel(null);
            }
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, [getModelById]);

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
