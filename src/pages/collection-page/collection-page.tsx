import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useSearchParams} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import "./collection-page.css";

import {Header} from "../../components/Header/Header";
import {Sidebar} from "../../components/Sidebar/Sidebar";
import {ModelCard} from "../../components/ModelCard/ModelCard";
import {DetailsModal} from "../../components/DetailsModal/DetailsModal";

import truckModelsData from "../../data/truck-models.json";

import type {AppError} from "../../lib/errors.ts";
import {getModels} from "../../services/models.ts";
import {toLegacyModel} from "../../services/legacy-adapter.ts";
import type {ModelSummary} from "../../services/types.ts";

import type {DiecastModel, DiecastType} from "../../types.ts";
import {DEFAULT_FILTERS, filterModels, findModelById, type Filters} from "../../utils/collection-filters.ts";
import {withModelParam, withoutModelParam} from "../../utils/url-params.ts";

type CollectionPageProps = {
    type: DiecastType;
};

export function CollectionPage({type}: CollectionPageProps) {
    const [searchParams, setSearchParams] = useSearchParams();

    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const lastOpenedModelIdRef = useRef<string | null>(null);

    // Cars are Supabase-backed (ROADMAP Phase 10); trucks still read the legacy JSON directly
    // (retired in Phase 11). `enabled` keeps this from firing at all on /trucks.
    const carsQuery = useQuery<ModelSummary[], AppError>({
        queryKey: ["models", "cars"],
        queryFn: getModels,
        enabled: type === "cars",
    });

    const models = useMemo(() => {
        return type === "cars"
            ? (carsQuery.data ?? []).map(toLegacyModel)
            : truckModelsData as DiecastModel[];
    }, [type, carsQuery.data]);

    const filteredModels = useMemo(() => filterModels(models, filters), [models, filters]);

    const getModelById = useCallback((id: string): DiecastModel | undefined => {
        return findModelById(models, id);
    }, [models]);

    const modelId = searchParams.get("model");

    const modelFromUrl = useMemo(() => {
        if (!modelId) {
            return null;
        }

        return getModelById(modelId) ?? null;
    }, [modelId, getModelById]);

    // Legacy modal/deep-link state; replaced by the details page in ROADMAP Phase 19.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
        setSearchParams(withModelParam(searchParams, model.id), {replace: false});
    }, [searchParams, setSearchParams]);

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        lastOpenedModelIdRef.current = null;

        setSearchParams(withoutModelParam(searchParams), {replace: false});
    }, [searchParams, setSearchParams]);

    const scrollToTop = () => {
        window.scrollTo({top: 0, behavior: "smooth"});
    };

    useEffect(() => {
        if (!modelId || !modelFromUrl) {
            // Legacy scroll-then-open logic; removed in ROADMAP Phase 19.
            // eslint-disable-next-line react-hooks/set-state-in-effect
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
                    {type === "cars" && carsQuery.isPending ? (
                        <div className="contentEmpty">Loading the collection…</div>
                    ) : type === "cars" && carsQuery.isError ? (
                        <div className="contentError">
                            <p>{carsQuery.error.message}</p>
                            <button type="button" className="retryButton" onClick={() => carsQuery.refetch()}>
                                Try again
                            </button>
                        </div>
                    ) : filteredModels.length === 0 ? (
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
