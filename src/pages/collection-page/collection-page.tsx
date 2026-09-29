import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useSearchParams} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import "./collection-page.css";

import {Header} from "../../components/Header/Header";
import {CollectionToolbar} from "../../components/CollectionToolbar/CollectionToolbar";
import {ModelCard} from "../../components/ModelCard/ModelCard";
import {ModelCardSkeleton} from "../../components/ModelCard/ModelCardSkeleton";
import {DetailsModal} from "../../components/DetailsModal/DetailsModal";

import {useCollectionQuery} from "../../hooks/useCollectionQuery.ts";
import type {AppError} from "../../lib/errors.ts";
import {getModels} from "../../services/models.ts";
import {filterModels, getFacetCounts, searchModels, sortModels} from "../../services/collection-query.ts";
import {toLegacyModel} from "../../services/legacy-adapter.ts";
import {getCollectionStats} from "../../services/stats.ts";
import type {ModelSummary} from "../../services/types.ts";

import type {DiecastModel} from "../../types.ts";
import {findModelById} from "../../utils/collection-filters.ts";
import {withModelParam, withoutModelParam} from "../../utils/url-params.ts";

// A fixed key set (not an index) avoids remounting skeleton nodes on every render.
const SKELETON_KEYS = Array.from({length: 8}, (_, i) => `skeleton-${i}`);

export function CollectionPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const {filters, query, sort, toggleFilter, clearFilters, setSort} = useCollectionQuery();

    const [showScrollTop, setShowScrollTop] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const lastOpenedModelIdRef = useRef<string | null>(null);

    // Cars are Supabase-backed (ROADMAP Phase 10) — trucks are retired (Phase 11).
    const carsQuery = useQuery<ModelSummary[], AppError>({
        queryKey: ["models", "cars"],
        queryFn: getModels,
    });
    const summaries = useMemo(() => carsQuery.data ?? [], [carsQuery.data]);

    // Filter -> search -> sort, all on the Supabase domain shape (ModelSummary); toLegacyModel()
    // only maps the final result for the still-legacy ModelCard/DetailsModal (Phase 16/19 replace
    // those). Facets are computed pre-search/sort — they describe "what else is in this filtered
    // set", not "what's currently visible after searching", so a search doesn't zero them out.
    const filteredSummaries = useMemo(() => filterModels(summaries, filters), [summaries, filters]);
    const searchedSummaries = useMemo(() => searchModels(filteredSummaries, query), [filteredSummaries, query]);
    const visibleSummaries = useMemo(() => sortModels(searchedSummaries, sort, query), [searchedSummaries, sort, query]);
    const facets = useMemo(() => getFacetCounts(summaries, filters), [summaries, filters]);
    const stats = useMemo(() => getCollectionStats(summaries), [summaries]);

    // DetailsModal still needs the legacy shape (Phase 19 replaces it); ModelCard now renders
    // straight off ModelSummary (Phase 16) — no toLegacyModel() in the render path below.
    const models = useMemo(() => summaries.map(toLegacyModel), [summaries]);

    // ?model= looks up the full (unfiltered) list — a shared/deep link should open its model
    // regardless of the current filters, matching the pre-Phase-13 behavior.
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

    useEffect(() => {
        const onScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };

        window.addEventListener("scroll", onScroll);

        return () => {
            window.removeEventListener("scroll", onScroll);
        };
    }, []);

    const openModal = useCallback((slug: string) => {
        setSearchParams(withModelParam(searchParams, slug), {replace: false});
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
    }, [modelId, modelFromUrl, visibleSummaries]);

    return (
        <div className="layout">
            <Header count={stats.totalModels}/>

            <div className="content">
                <main className="main">
                    <CollectionToolbar
                        filters={filters}
                        facets={facets}
                        resultsCount={visibleSummaries.length}
                        onToggle={toggleFilter}
                        onClear={clearFilters}
                        sort={sort}
                        onSortChange={setSort}
                        hasQuery={!!query.trim()}
                    />

                    {carsQuery.isPending ? (
                        <div className="modelGrid">
                            {SKELETON_KEYS.map((key) => <ModelCardSkeleton key={key}/>)}
                        </div>
                    ) : carsQuery.isError ? (
                        <div className="contentError">
                            <p>{carsQuery.error.message}</p>
                            <button type="button" className="retryButton" onClick={() => carsQuery.refetch()}>
                                Try again
                            </button>
                        </div>
                    ) : visibleSummaries.length === 0 ? (
                        <div className="contentEmpty">
                            {query.trim() ? `No models match "${query.trim()}".` : "No models match the selected filters."}
                        </div>
                    ) : (
                        <div className="modelGrid">
                            {visibleSummaries.map((m) => (
                                <ModelCard
                                    key={m.slug}
                                    model={m}
                                    onClick={() => openModal(m.slug)}
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
