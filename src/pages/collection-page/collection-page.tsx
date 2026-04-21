import {useCallback, useEffect, useMemo, useState} from "react";
import {useSearchParams} from "react-router-dom";
import "./collection-page.css";

import {Header} from "../../components/Header/Header";
import {Sidebar, type Filters} from "../../components/Sidebar/Sidebar";
import {ModelCard} from "../../components/ModelCard/ModelCard";
import {DetailsModal} from "../../components/DetailsModal/DetailsModal";

import carModelsData from "../../data/car-models.json";
import truckModelsData from "../../data/truck-models.json";

import type {DiecastModel, DiecastType} from "../../types.ts";

type CollectionPageProps = {
    type: DiecastType;
};

const DEFAULT_FILTERS: Filters = {
    brand: "All",
    manufacturer: "All",
    category: "All",
    color: "All",
};

export function CollectionPage({type}: CollectionPageProps) {
    const [searchParams, setSearchParams] = useSearchParams();

    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [selectedModel, setSelectedModel] = useState<DiecastModel | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);

    const models = useMemo(() => {
        return type === "cars"
            ? carModelsData as DiecastModel[]
            : truckModelsData as DiecastModel[];
    }, [type]);

    const filteredModels = useMemo(() => {
        return models.filter((model) => {
            const brandMatch =
                filters.brand === "All" || model.brand === filters.brand;

            const manufacturerMatch =
                filters.manufacturer === "All" || model.manufacturer === filters.manufacturer;

            const categoryMatch =
                filters.category === "All" || model.category === filters.category;

            const modelColors = Array.isArray(model.color) ? model.color : [model.color];
            const colorMatch =
                filters.color === "All" || modelColors.includes(filters.color);

            return brandMatch && manufacturerMatch && categoryMatch && colorMatch;
        });
    }, [models, filters]);

    const getModelById = useCallback((id: string): DiecastModel | undefined => {
        return models.find((m) => String(m.id) === String(id));
    }, [models]);

    useEffect(() => {
        setSelectedModel(null);
        window.scrollTo({top: 0, behavior: "auto"});
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

        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set("model", String(model.id));
        setSearchParams(nextSearchParams, {replace: false});
    }, [searchParams, setSearchParams]);

    const closeModal = useCallback(() => {
        setSelectedModel(null);

        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.delete("model");
        setSearchParams(nextSearchParams, {replace: false});
    }, [searchParams, setSearchParams]);

    const scrollToTop = () => {
        window.scrollTo({top: 0, behavior: "smooth"});
    };

    useEffect(() => {
        const modelId = searchParams.get("model");

        if (!modelId) {
            setSelectedModel(null);
            return;
        }

        const model = getModelById(modelId);

        if (!model) {
            setSelectedModel(null);
            return;
        }

        if (selectedModel?.id === model.id) {
            return;
        }

        const card = document.getElementById(String(model.id));

        if (card) {
            setTimeout(() => {
                card.scrollIntoView({behavior: "smooth", block: "center"});
                setSelectedModel(model);
            }, 300);
        } else {
            setSelectedModel(model);
        }
    }, [searchParams, getModelById, selectedModel]);

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
