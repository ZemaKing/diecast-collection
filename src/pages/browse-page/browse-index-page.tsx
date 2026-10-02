import {useMemo} from "react";
import {useSearchParams} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";

import {BrowseTile, BrowseTileSkeleton} from "../../components/Browse/Browse.tsx";
import {EmptyState, ErrorState} from "../../components/States/States.tsx";
import {Header} from "../../components/Header/Header";
import {PageIntro} from "../../components/PageIntro/PageIntro.tsx";

import {useScrollRestoration} from "../../hooks/useScrollRestoration.ts";
import type {AppError} from "../../lib/errors.ts";
import {getBrowseEntries, sortBrowseEntries, type BrowseKind, type BrowseSort} from "../../services/browse.ts";
import {getModels} from "../../services/models.ts";
import type {ModelSummary} from "../../services/types.ts";
import {BROWSE_LABELS, getBrowseSortFromSearchParams, withBrowseSort} from "../../utils/browse-link.ts";
import {pluralizeModels} from "../../utils/collection-summary.ts";

import "../collection-page/collection-page.css";
import "./browse-page.css";

const SKELETON_KEYS = Array.from({length: 9}, (_, i) => `skeleton-${i}`);

const ORDER_OPTIONS: {value: BrowseSort; label: string}[] = [
    {value: "count", label: "Most models"},
    {value: "name", label: "A–Z"},
];

// `/manufacturers` and `/brands` (ROADMAP Phase 22) — one component, `kind` picks the data.
// Everything is derived from the cached summary list the collection page already loaded, so
// arriving from the collection costs no request, and every count equals the filter panel's.
export function BrowseIndexPage({kind}: {kind: BrowseKind}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const order = getBrowseSortFromSearchParams(searchParams);
    const labels = BROWSE_LABELS[kind];

    const modelsQuery = useQuery<ModelSummary[], AppError>({queryKey: ["models", "cars"], queryFn: getModels});
    const models = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);
    const entries = useMemo(() => sortBrowseEntries(getBrowseEntries(models, kind), order), [models, kind, order]);

    useScrollRestoration({ready: modelsQuery.isSuccess});

    const setOrder = (value: BrowseSort) => setSearchParams((current) => withBrowseSort(current, value), {replace: true});

    return (
        <div className="layout">
            <Header count={models.length}/>

            <div className="content">
                <main className="main">
                    <PageIntro
                        eyebrow="Browse"
                        title={labels.plural}
                        subtitle={modelsQuery.isSuccess
                            ? `${entries.length} ${(entries.length === 1 ? labels.singular : labels.plural).toLowerCase()} · ${models.length} ${pluralizeModels(models.length)}`
                            : null}
                    >
                        <div className="browseOrder" role="group" aria-label="Order">
                            {ORDER_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`browseOrderButton${option.value === order ? " browseOrderButtonActive" : ""}`}
                                    aria-pressed={option.value === order}
                                    onClick={() => setOrder(option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </PageIntro>

                    {modelsQuery.isPending ? (
                        <div className="browseGrid">
                            {SKELETON_KEYS.map((key) => <BrowseTileSkeleton key={key}/>)}
                        </div>
                    ) : modelsQuery.isError ? (
                        <ErrorState error={modelsQuery.error} onRetry={() => modelsQuery.refetch()} retrying={modelsQuery.isFetching}/>
                    ) : entries.length === 0 ? (
                        <EmptyState title={`No ${labels.plural.toLowerCase()} yet`}>
                            <p>They appear here as soon as the collection has a model.</p>
                        </EmptyState>
                    ) : (
                        <ul className="browseGrid browseList">
                            {entries.map((entry) => (
                                <li key={entry.slug}>
                                    <BrowseTile kind={kind} entry={entry}/>
                                </li>
                            ))}
                        </ul>
                    )}
                </main>
            </div>
        </div>
    );
}
