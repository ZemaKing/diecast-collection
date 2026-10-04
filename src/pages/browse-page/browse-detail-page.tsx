import {useCallback, useMemo, useState} from "react";
import {Link, Navigate, useLocation, useParams} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";

import {BrowseLogo, CategoryMixBar} from "../../components/Browse/Browse.tsx";
import {Breadcrumb} from "../../components/Breadcrumb/Breadcrumb.tsx";
import {SortTrigger} from "../../components/CollectionToolbar/CollectionToolbar.tsx";
import {CategoryPills} from "../../components/CollectionToolbar/FilterFields.tsx";
import {Header} from "../../components/Header/Header";
import {ModelCard} from "../../components/ModelCard/ModelCard";
import {ModelCardSkeleton} from "../../components/ModelCard/ModelCardSkeleton";
import {QuickView} from "../../components/QuickView/QuickView.tsx";
import {NotFoundPage} from "../not-found-page/not-found-page";

import {useCollectionQuery} from "../../hooks/useCollectionQuery.ts";
import {useScrollRestoration} from "../../hooks/useScrollRestoration.ts";
import {ChevronRight} from "../../icons/ChevronRight.tsx";
import {getBrowseEntry, getBrowseModels, type BrowseKind} from "../../services/browse.ts";
import {EMPTY_FILTERS, filterModels, getFacetCounts, sortModels} from "../../services/collection-query.ts";
import {modelSummariesQuery} from "../../hooks/model-queries.ts";
import type {ModelSummary} from "../../services/types.ts";
import {formatRelated, formatYears} from "../../utils/browse-display.ts";
import {BROWSE_LABELS, browseCollectionPath, browseIndexPath, browsePath} from "../../utils/browse-link.ts";
import {describeResults, pluralizeModels} from "../../utils/collection-summary.ts";
import {readFocusModel} from "../../utils/model-link.ts";
import {PRIORITY_IMAGE_COUNT} from "../../utils/model-display.ts";
import {slugify} from "../../utils/slug.ts";
import {MAIN_CONTENT_ID} from "../../utils/a11y.ts";

import "../../components/PageIntro/PageIntro.css";
import "../collection-page/collection-page.css";
import "./browse-page.css";
import {EmptyState, ErrorState, Skeleton} from "../../components/States/States.tsx";
import {usePageTitle} from "../../hooks/usePageTitle.ts";

const SKELETON_KEYS = Array.from({length: 10}, (_, i) => `skeleton-${i}`);

// `/manufacturers/:slug` and `/brands/:slug` (ROADMAP Phase 22): the profile (logo, count, years,
// categories represented) over the models, as the collection's own cards. It reuses the
// collection's query pipeline and URL state (useCollectionQuery: `?category=` narrows by the
// category pills, `?sort=` orders), with this page's brand/manufacturer pinned — the rest of the
// filters, search and view modes are one click away in the collection ("Open in collection").
export function BrowseDetailPage({kind}: {kind: BrowseKind}) {
    const {slug = ""} = useParams();
    const location = useLocation();
    const {filters, sort, toggleFilter, clearFilters, setSort} = useCollectionQuery();
    const labels = BROWSE_LABELS[kind];

    // Quick View belongs to the history entry it was opened on: its Brand/Manufacturer tile can
    // link to this very page, and that navigation should close it like any other.
    const [quickView, setQuickView] = useState<{model: ModelSummary; locationKey: string} | null>(null);
    const quickViewModel = quickView?.locationKey === location.key ? quickView.model : null;
    const openQuickView = useCallback((model: ModelSummary) => setQuickView({model, locationKey: location.key}), [location.key]);
    const closeQuickView = useCallback(() => setQuickView(null), []);

    const modelsQuery = useQuery(modelSummariesQuery);
    const models = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);

    const entry = useMemo(() => getBrowseEntry(models, kind, slug), [models, kind, slug]);
    const own = useMemo(() => getBrowseModels(models, kind, slug), [models, kind, slug]);
    const categoryFilters = useMemo(() => ({...EMPTY_FILTERS, categories: filters.categories}), [filters.categories]);
    // Pills count against this page's models only (the same numbers the collection's Category
    // filter shows with this brand/manufacturer selected).
    const categoryFacets = useMemo(() => getFacetCounts(own, categoryFilters).categories, [own, categoryFilters]);
    const visible = useMemo(() => sortModels(filterModels(own, categoryFilters), sort), [own, categoryFilters, sort]);

    useScrollRestoration({ready: modelsQuery.isSuccess, focusId: readFocusModel(location.state)});
    usePageTitle(entry ? `${entry.name} · ${labels.plural}` : null);

    // `/brands/Citroën` or `/brands/Ford` (hand-typed, or a name pasted in) → the canonical slug.
    const canonical = slugify(slug);
    if (canonical && canonical !== slug) {
        return <Navigate to={{pathname: browsePath(kind, canonical), search: location.search}} replace/>;
    }

    if (modelsQuery.isSuccess && !entry) {
        return <NotFoundPage/>;
    }

    const results = entry && describeResults({visible: visible.length, total: entry.count, activeFilterCount: filters.categories.length, query: ""});

    return (
        <div className="layout">
            <Header/>

            <div className="content">
                <Breadcrumb
                    home={{to: "/"}}
                    trail={[
                        {label: labels.plural, to: browseIndexPath(kind)},
                        ...(entry ? [{label: entry.name}] : []),
                    ]}
                />

                <main id={MAIN_CONTENT_ID} tabIndex={-1} className="main">
                    {modelsQuery.isError ? (
                        <ErrorState error={modelsQuery.error} onRetry={() => modelsQuery.refetch()} retrying={modelsQuery.isFetching}/>
                    ) : !entry ? (
                        <>
                            <div className="browseProfile" aria-hidden="true">
                                <Skeleton as="div" className="browseLogo browseLogo-profile"/>
                                <div className="browseProfileText">
                                    <Skeleton variant="line" className="skeletonBarTitle"/>
                                    <Skeleton variant="line" className="skeletonBarMeta"/>
                                </div>
                            </div>
                            <div className="modelGrid">
                                {SKELETON_KEYS.map((key) => <ModelCardSkeleton key={key}/>)}
                            </div>
                        </>
                    ) : (
                        <>
                            <section className="browseProfile" aria-labelledby="browse-profile-title">
                                <BrowseLogo entry={entry} size="profile"/>
                                <div className="browseProfileText">
                                    <p className="pageEyebrow">{labels.singular}</p>
                                    <h1 id="browse-profile-title" className="pageTitle">{entry.name}</h1>
                                    <p className="browseFacts">
                                        <span className="browseFactsCount">{entry.count}</span> {pluralizeModels(entry.count)}
                                        <span aria-hidden="true"> · </span>
                                        {formatYears(entry.years)}
                                        <span aria-hidden="true"> · </span>
                                        {formatRelated(kind, entry.relatedCount)}
                                    </p>
                                </div>

                                <div className="browseCategories">
                                    <h2 className="browseCategoriesTitle">
                                        {entry.categories.length === 1 ? "Category" : "Categories"}
                                    </h2>
                                    <CategoryMixBar categories={entry.categories} total={entry.count}/>
                                    {/* The pills double as the bar's legend and as this page's filter. */}
                                    <CategoryPills
                                        options={categoryFacets}
                                        selected={filters.categories}
                                        onToggle={(value) => toggleFilter("categories", value)}
                                    />
                                </div>
                            </section>

                            <div className="browseResultsBar">
                                <p className={`resultsHeader${results?.isNarrowed ? " resultsHeaderNarrowed" : ""}`} aria-live="polite">
                                    <span className="resultsHeaderCount">{results?.count}</span>
                                    {filters.categories.length > 0 && (
                                        <button type="button" className="clearAllButton" onClick={clearFilters}>
                                            Clear
                                        </button>
                                    )}
                                </p>

                                <div className="browseResultsActions">
                                    <Link to={browseCollectionPath(kind, entry.slug, filters.categories)} className="browseCollectionLink">
                                        Open in collection
                                        <ChevronRight width={14} height={14}/>
                                    </Link>
                                    <SortTrigger
                                        sort={sort}
                                        onChange={setSort}
                                        showRelevance={false}
                                        hiddenOptions={[kind === "brands" ? "brand" : "manufacturer"]}
                                    />
                                </div>
                            </div>

                            {visible.length === 0 ? (
                                <EmptyState
                                    title={`No ${entry.name} models in the selected categories`}
                                    icon="filter"
                                    actions={<button type="button" className="stateButton stateButtonPrimary" onClick={clearFilters}>Show all categories</button>}
                                />
                            ) : (
                                <div className="modelGrid">
                                    {visible.map((m, index) => (
                                        <ModelCard key={m.slug} model={m} onQuickView={openQuickView} priority={index < PRIORITY_IMAGE_COUNT}/>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            {quickViewModel && (
                <QuickView key={quickViewModel.slug} model={quickViewModel} onClose={closeQuickView}/>
            )}
        </div>
    );
}
