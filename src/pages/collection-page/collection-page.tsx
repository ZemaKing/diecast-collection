import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {useSearchParams} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import "./collection-page.css";

import {Header} from "../../components/Header/Header";
import {CollectionHero} from "../../components/CollectionHero/CollectionHero";
import {CollectionToolbar} from "../../components/CollectionToolbar/CollectionToolbar";
import {ModelCard} from "../../components/ModelCard/ModelCard";
import {ModelCardSkeleton} from "../../components/ModelCard/ModelCardSkeleton";
import {ModelCompactRow, ModelListRow, ModelRowSkeleton} from "../../components/ModelCard/ModelRow.tsx";
import {DetailsModal} from "../../components/DetailsModal/DetailsModal";

import {useCollectionQuery} from "../../hooks/useCollectionQuery.ts";
import {useViewMode} from "../../hooks/useViewMode.ts";
import type {AppError} from "../../lib/errors.ts";
import {getModels} from "../../services/models.ts";
import {filterModels, getFacetCounts, searchModels, sortModels} from "../../services/collection-query.ts";
import {toLegacyModel} from "../../services/legacy-adapter.ts";
import {getCollectionStats} from "../../services/stats.ts";
import type {ModelSummary} from "../../services/types.ts";

import type {DiecastModel} from "../../types.ts";
import {findModelById} from "../../utils/collection-filters.ts";
import {describeResults} from "../../utils/collection-summary.ts";
import {withModelParam, withoutModelParam} from "../../utils/url-params.ts";
import type {ViewMode} from "../../utils/view-mode.ts";

// A fixed key set (not an index) avoids remounting skeleton nodes on every render. 10 = two full
// rows at the mockup's 5-column desktop grid.
const SKELETON_KEYS = Array.from({length: 10}, (_, i) => `skeleton-${i}`);

// Hero background photo — an owner-supplied asset (ROADMAP Phase 17), not yet delivered. Drop it in
// `public/` and point this at it; until then the hero renders its token-only gradient backdrop.
const HERO_ART_URL: string | null = null;

// One container class per view mode (ROADMAP Phase 18) — the skeletons share it, so loading →
// loaded never reflows.
const RESULTS_CLASS: Record<ViewMode, string> = {
    grid: "modelGrid",
    list: "modelList",
    compact: "modelCompactList",
};

type ScrollAnchor = {id: string; top: number};

// The first result still (at least partly) on screen, and where it sits in the viewport. Switching
// view modes changes every item's height, so restoring this keeps the reader on the same model
// instead of teleporting them to wherever the old scroll offset lands in the new layout.
function findScrollAnchor(container: HTMLElement | null): ScrollAnchor | null {
    if (!container) return null;

    for (const child of container.children) {
        const rect = child.getBoundingClientRect();
        if (child.id && rect.bottom > 0) return {id: child.id, top: rect.top};
    }

    return null;
}

export function CollectionPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const {filters, query, sort, toggleFilter, clearFilters, setSort} = useCollectionQuery();
    const {viewMode, setViewMode} = useViewMode();

    const [showScrollTop, setShowScrollTop] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const lastOpenedModelIdRef = useRef<string | null>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const scrollAnchorRef = useRef<ScrollAnchor | null>(null);

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
    const activeFilterCount = Object.values(filters).reduce((n, values) => n + values.length, 0);
    const results = describeResults({visible: visibleSummaries.length, total: stats.totalModels, activeFilterCount, query});

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

    const changeViewMode = useCallback((mode: ViewMode) => {
        if (mode === viewMode) return;
        scrollAnchorRef.current = findScrollAnchor(resultsRef.current);
        setViewMode(mode);
    }, [viewMode, setViewMode]);

    // Runs before paint, so the jump to the anchored model is never visible.
    useLayoutEffect(() => {
        const anchor = scrollAnchorRef.current;
        scrollAnchorRef.current = null;
        if (!anchor) return;

        const element = document.getElementById(anchor.id);
        if (element) window.scrollBy(0, element.getBoundingClientRect().top - anchor.top);
    }, [viewMode]);

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
                    <CollectionHero
                        count={carsQuery.isSuccess ? stats.totalModels : null}
                        scales={stats.scales}
                        isLoading={carsQuery.isPending}
                        artUrl={HERO_ART_URL}
                    />

                    <CollectionToolbar
                        filters={filters}
                        facets={facets}
                        resultsCount={visibleSummaries.length}
                        onToggle={toggleFilter}
                        onClear={clearFilters}
                        sort={sort}
                        onSortChange={setSort}
                        hasQuery={!!query.trim()}
                        viewMode={viewMode}
                        onViewModeChange={changeViewMode}
                    />

                    {/* Results header (Phase 17): what the grid below is showing, and why. Polite
                        live region so filter/search changes are announced without stealing focus.
                        Rendered while loading too, so the grid doesn't shift down when data lands. */}
                    {!carsQuery.isError && (
                        <p className={`resultsHeader${results.isNarrowed ? " resultsHeaderNarrowed" : ""}`} aria-live="polite">
                            {carsQuery.isPending ? (
                                <span className="resultsHeaderDetail">Loading models…</span>
                            ) : (
                                <>
                                    <span className="resultsHeaderCount">{results.count}</span>
                                    {results.detail && <span className="resultsHeaderDetail">{results.detail}</span>}
                                </>
                            )}
                        </p>
                    )}

                    {carsQuery.isPending ? (
                        <div className={RESULTS_CLASS[viewMode]}>
                            {SKELETON_KEYS.map((key) => viewMode === "grid"
                                ? <ModelCardSkeleton key={key}/>
                                : <ModelRowSkeleton key={key} variant={viewMode}/>)}
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
                        <div ref={resultsRef} className={RESULTS_CLASS[viewMode]}>
                            {visibleSummaries.map((m) => {
                                const onClick = () => openModal(m.slug);
                                if (viewMode === "list") return <ModelListRow key={m.slug} model={m} onClick={onClick}/>;
                                if (viewMode === "compact") return <ModelCompactRow key={m.slug} model={m} onClick={onClick}/>;
                                return <ModelCard key={m.slug} model={m} onClick={onClick}/>;
                            })}
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
                <button className="scrollTopButton" onClick={scrollToTop} type="button" aria-label="Back to top">
                    ˄
                </button>
            )}
        </div>
    );
}
