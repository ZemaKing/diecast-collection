import {useCallback, useEffect, useMemo, useRef, useState} from "react";
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
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const lastOpenedModelIdRef = useRef<string | null>(null);

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

    const modelId = searchParams.get("model");

    const modelFromUrl = useMemo(() => {
        if (!modelId) {
            return null;
        }

        return getModelById(modelId) ?? null;
    }, [modelId, getModelById]);

    useEffect(() => {
        setIsModalOpen(false);
        lastOpenedModelIdRef.current = null;
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
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set("model", String(model.id));
        setSearchParams(nextSearchParams, {replace: false});
    }, [searchParams, setSearchParams]);

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        lastOpenedModelIdRef.current = null;

        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.delete("model");
        setSearchParams(nextSearchParams, {replace: false});
    }, [searchParams, setSearchParams]);

    const scrollToTop = () => {
        window.scrollTo({top: 0, behavior: "smooth"});
    };

    useEffect(() => {
        if (!modelId || !modelFromUrl) {
            setIsModalOpen(false);
            lastOpenedModelIdRef.current = null;
            return;
        }

        if (lastOpenedModelIdRef.current === modelId) {
            return;
        }

        const card = document.getElementById(String(modelFromUrl.id));

        if (!card) {
            setIsModalOpen(true);
            lastOpenedModelIdRef.current = modelId;
            return;
        }

        const timeoutId = window.setTimeout(() => {
            card.scrollIntoView({behavior: "smooth", block: "center"});

            const openTimeoutId = window.setTimeout(() => {
                setIsModalOpen(true);
                lastOpenedModelIdRef.current = modelId;
            }, 450);

            return () => {
                window.clearTimeout(openTimeoutId);
            };
        }, 150);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [modelId, modelFromUrl, filteredModels]);

    return (
        <div className="layout">
            <Header title="ZemaKing Diecast Collection" count={models.length}/>

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
                            {filteredModels.map((m) => (
                                <ModelCard
                                    key={m.id}
                                    model={m}
                                    onClick={() => openModal(m)}
                                />
                            ))}
                        </div>
                    )}

                    <DetailsModal
                        model={modelFromUrl}
                        isOpen={!!modelFromUrl && isModalOpen}
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
