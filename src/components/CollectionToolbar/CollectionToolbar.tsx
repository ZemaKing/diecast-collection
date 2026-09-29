import {useState} from "react";

import {Filter} from "../../icons/Filter.tsx";
import type {CollectionFilters, FacetCount, FacetCounts} from "../../services/collection-query.ts";

import "./CollectionToolbar.css";

type FilterKey = keyof CollectionFilters;

type CollectionToolbarProps = {
    filters: CollectionFilters;
    facets: FacetCounts;
    resultsCount: number;
    onToggle: (key: FilterKey, value: string) => void;
    onClear: () => void;
};

const GROUPS: {key: FilterKey; label: string}[] = [
    {key: "brands", label: "Brand"},
    {key: "manufacturers", label: "Manufacturer"},
    {key: "categories", label: "Category"},
    {key: "colors", label: "Color"},
];

function FilterTrigger({label, options, selected, onToggle}: {
    label: string;
    options: FacetCount[];
    selected: string[];
    onToggle: (value: string) => void;
}) {
    return (
        <details className="filterTrigger">
            <summary className="filterTriggerSummary">
                {label}
                {selected.length > 0 && <span className="filterTriggerCount">{selected.length}</span>}
            </summary>
            <div className="filterTriggerPanel">
                {options.length === 0 ? (
                    <p className="filterTriggerEmpty">No options</p>
                ) : (
                    options.map((option) => (
                        <label key={option.slug} className="filterOption">
                            <input
                                type="checkbox"
                                checked={selected.includes(option.slug)}
                                onChange={() => onToggle(option.slug)}
                            />
                            <span className="filterOptionName">{option.name}</span>
                            <span className="filterOptionCount">{option.count}</span>
                        </label>
                    ))
                )}
            </div>
        </details>
    );
}

export function CollectionToolbar({filters, facets, resultsCount, onToggle, onClear}: CollectionToolbarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const activeCount = GROUPS.reduce((n, {key}) => n + filters[key].length, 0);

    const chips = GROUPS.flatMap(({key}) =>
        filters[key].map((slug) => ({
            key,
            slug,
            name: facets[key].find((o) => o.slug === slug)?.name ?? slug,
        })),
    );

    return (
        <div className="toolbar">
            <div className="toolbarRow">
                <button
                    type="button"
                    className="filtersToggle"
                    onClick={() => setIsOpen((open) => !open)}
                    aria-expanded={isOpen}
                    aria-controls="collectionFilterTriggers"
                >
                    <Filter/>
                    Filters
                    {activeCount > 0 && <span className="filtersToggleCount">{activeCount}</span>}
                </button>

                <div id="collectionFilterTriggers" className={`toolbarTriggers${isOpen ? " toolbarTriggersOpen" : ""}`}>
                    {GROUPS.map(({key, label}) => (
                        <FilterTrigger
                            key={key}
                            label={label}
                            options={facets[key]}
                            selected={filters[key]}
                            onToggle={(value) => onToggle(key, value)}
                        />
                    ))}

                    {activeCount > 0 && (
                        <button type="button" className="clearAllButton" onClick={onClear}>
                            Clear all
                        </button>
                    )}
                </div>

                <span className="resultsCount">{resultsCount} models</span>

                {/* View modes and sort: visual placeholders only — wired in Phases 18 and 15. */}
                <div className="toolbarPlaceholders">
                    <div className="viewModeGroup" aria-hidden="true">
                        <button type="button" className="viewModeButton viewModeButtonActive" disabled title="Grid view">⊞</button>
                        <button type="button" className="viewModeButton" disabled title="List view — coming soon">☰</button>
                        <button type="button" className="viewModeButton" disabled title="Compact view — coming soon">≡</button>
                    </div>
                    <button type="button" className="sortTrigger" disabled title="Sorting is coming in a future update">
                        Sort: Recently added ▾
                    </button>
                </div>
            </div>

            {chips.length > 0 && (
                <div className="chipsRow">
                    {chips.map((chip) => (
                        <button
                            key={`${chip.key}:${chip.slug}`}
                            type="button"
                            className="chip"
                            onClick={() => onToggle(chip.key, chip.slug)}
                        >
                            {chip.name} <span aria-hidden="true">×</span>
                            <span className="visuallyHidden">Remove {chip.name} filter</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
