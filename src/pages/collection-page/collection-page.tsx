import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {Navigate, useLocation, useSearchParams} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import "./collection-page.css";

import {Header} from "../../components/Header/Header";
import {CollectionHero} from "../../components/CollectionHero/CollectionHero";
import {CollectionToolbar} from "../../components/CollectionToolbar/CollectionToolbar";
import {ModelCard} from "../../components/ModelCard/ModelCard";
import {ModelCardSkeleton} from "../../components/ModelCard/ModelCardSkeleton";
import {ModelCompactRow, ModelListRow, ModelRowSkeleton} from "../../components/ModelCard/ModelRow.tsx";
import {QuickView} from "../../components/QuickView/QuickView.tsx";
import {EmptyState, ErrorState} from "../../components/States/States.tsx";

import {useCollectionQuery} from "../../hooks/useCollectionQuery.ts";
import {useScrollRestoration} from "../../hooks/useScrollRestoration.ts";
import {useViewMode} from "../../hooks/useViewMode.ts";
import type {AppError} from "../../lib/errors.ts";
import {getModels} from "../../services/models.ts";
import {filterModels, getFacetCounts, searchModels, sortModels} from "../../services/collection-query.ts";
import {getCollectionStats} from "../../services/stats.ts";
import type {ModelSummary} from "../../services/types.ts";

import {describeEmptyResults, describeResults} from "../../utils/collection-summary.ts";
import {getLegacyModelRedirect, readFocusModel, type ModelLinkState} from "../../utils/model-link.ts";
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
        // Grid cards with a Quick View button are wrapped in a shell carrying the slug instead.
        const id = child.id || (child instanceof HTMLElement ? child.dataset.slug : undefined);
        if (id && rect.bottom > 0) return {id, top: rect.top};
    }

    return null;
}

export function CollectionPage() {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const {filters, query, sort, toggleFilter, clearFilters, clearQuery, setSort} = useCollectionQuery();
    const {viewMode, setViewMode} = useViewMode();

    const [showScrollTop, setShowScrollTop] = useState(false);
    // Quick View (ROADMAP Phase 20) — local UI state, not in the URL: the details page is the
    // shareable/deep-linkable view of a model.
    const [quickViewModel, setQuickViewModel] = useState<ModelSummary | null>(null);
    const closeQuickView = useCallback(() => setQuickViewModel(null), []);

    const resultsRef = useRef<HTMLDivElement>(null);
    const scrollAnchorRef = useRef<ScrollAnchor | null>(null);

    // Cars are Supabase-backed (ROADMAP Phase 10) — trucks are retired (Phase 11).
    const carsQuery = useQuery<ModelSummary[], AppError>({
        queryKey: ["models", "cars"],
        queryFn: getModels,
    });
    const summaries = useMemo(() => carsQuery.data ?? [], [carsQuery.data]);

    // Filter -> search -> sort, all on the Supabase domain shape (ModelSummary). Facets are
    // computed pre-search/sort — they describe "what else is in this filtered set", not "what's
    // currently visible after searching", so a search doesn't zero them out.
    const filteredSummaries = useMemo(() => filterModels(summaries, filters), [summaries, filters]);
    const searchedSummaries = useMemo(() => searchModels(filteredSummaries, query), [filteredSummaries, query]);
    const visibleSummaries = useMemo(() => sortModels(searchedSummaries, sort, query), [searchedSummaries, sort, query]);
    const facets = useMemo(() => getFacetCounts(summaries, filters), [summaries, filters]);
    const stats = useMemo(() => getCollectionStats(summaries), [summaries]);
    const activeFilterCount = Object.values(filters).reduce((n, values) => n + values.length, 0);
    const results = describeResults({visible: visibleSummaries.length, total: stats.totalModels, activeFilterCount, query});

    // Back (or refresh) lands where the reader left off; returning via a details page's
    // breadcrumb brings that model's item into view instead (ROADMAP Phase 19).
    useScrollRestoration({ready: carsQuery.isSuccess, focusId: readFocusModel(location.state)});

    // Opening a model remembers the current filters/search/sort, so the details page's
    // "Collection" breadcrumb can return to exactly this view.
    const linkState = useMemo((): ModelLinkState => ({collectionSearch: location.search}), [location.search]);

    useEffect(() => {
        const onScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };

        window.addEventListener("scroll", onScroll);

        return () => {
            window.removeEventListener("scroll", onScroll);
        };
    }, []);

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

    // Pre-Phase-19 shared links (`/?model=<id>`, also reached via `/cars?model=`) opened a modal;
    // the model now has its own page. After every hook, so hook order never changes.
    const legacyRedirect = getLegacyModelRedirect(searchParams);
    if (legacyRedirect) {
        return <Navigate to={legacyRedirect.to} state={legacyRedirect.state} replace/>;
    }

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
                        <ErrorState error={carsQuery.error} onRetry={() => carsQuery.refetch()} retrying={carsQuery.isFetching}/>
                    ) : visibleSummaries.length === 0 ? (
                        <CollectionEmpty
                            total={stats.totalModels}
                            activeFilterCount={activeFilterCount}
                            query={query}
                            onClearSearch={clearQuery}
                            onClearFilters={clearFilters}
                        />
                    ) : (
                        <div ref={resultsRef} className={RESULTS_CLASS[viewMode]}>
                            {visibleSummaries.map((m) => {
                                if (viewMode === "list") return <ModelListRow key={m.slug} model={m} linkState={linkState}/>;
                                if (viewMode === "compact") return <ModelCompactRow key={m.slug} model={m} linkState={linkState}/>;
                                return <ModelCard key={m.slug} model={m} linkState={linkState} onQuickView={setQuickViewModel}/>;
                            })}
                        </div>
                    )}
                </main>
            </div>

            {quickViewModel && (
                <QuickView key={quickViewModel.slug} model={quickViewModel} linkState={linkState} onClose={closeQuickView}/>
            )}

            {showScrollTop && (
                <button className="scrollTopButton" onClick={scrollToTop} type="button" aria-label="Back to top">
                    ˄
                </button>
            )}
        </div>
    );
}

type CollectionEmptyProps = {
    total: number;
    activeFilterCount: number;
    query: string;
    onClearSearch: () => void;
    onClearFilters: () => void;
};

// No models at all / no search results / no filter results / both (Phase 29) — copy from
// describeEmptyResults(), with a button for each way out.
function CollectionEmpty({total, activeFilterCount, query, onClearSearch, onClearFilters}: CollectionEmptyProps) {
    const empty = describeEmptyResults({total, activeFilterCount, query});
    const icon = empty.kind === "no-models" ? "collection" : empty.kind === "no-filter-results" ? "filter" : "search";

    return (
        <EmptyState
            title={empty.title}
            icon={icon}
            actions={(empty.canClearSearch || empty.canClearFilters) && (
                <>
                    {empty.canClearSearch && (
                        <button type="button" className="stateButton stateButtonPrimary" onClick={onClearSearch}>Clear search</button>
                    )}
                    {empty.canClearFilters && (
                        <button type="button" className={`stateButton${empty.canClearSearch ? "" : " stateButtonPrimary"}`} onClick={onClearFilters}>
                            Clear filters
                        </button>
                    )}
                </>
            )}
        >
            <p>{empty.message}</p>
        </EmptyState>
    );
}
