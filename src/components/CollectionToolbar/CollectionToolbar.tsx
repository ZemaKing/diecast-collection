import {useEffect, useMemo, useRef, useState} from "react";
import {useQuery} from "@tanstack/react-query";

import {Close} from "../../icons/Close.tsx";
import {Filter} from "../../icons/Filter.tsx";
import {getColors} from "../../services/lookups.ts";
import type {CollectionFilters, FacetCount, FacetCounts, SortOption} from "../../services/collection-query.ts";
import {MEDIA} from "../../styles/breakpoints.ts";
import {CategoryPills, ColorSwatchList, SearchableCheckboxList} from "./FilterFields.tsx";
import {useDetailsPopover} from "./useDetailsPopover.ts";

import "./CollectionToolbar.css";

type FilterKey = keyof CollectionFilters;
type Variant = "search" | "pills" | "swatches";

type CollectionToolbarProps = {
    filters: CollectionFilters;
    facets: FacetCounts;
    resultsCount: number;
    onToggle: (key: FilterKey, value: string) => void;
    onClear: () => void;
    sort: SortOption;
    onSortChange: (sort: SortOption) => void;
    hasQuery: boolean;
};

const GROUPS: {key: FilterKey; label: string; variant: Variant}[] = [
    {key: "brands", label: "Brand", variant: "search"},
    {key: "manufacturers", label: "Manufacturer", variant: "search"},
    {key: "categories", label: "Category", variant: "pills"},
    {key: "colors", label: "Color", variant: "swatches"},
    // Scale: hidden until a second scale exists in the data (ROADMAP Phase 14).
];

// "Relevance" only makes sense (and only appears) while a search is active — see useCollectionQuery.ts.
const SORT_OPTIONS: {value: SortOption; label: string}[] = [
    {value: "added-desc", label: "Recently added"},
    {value: "added-asc", label: "Oldest added"},
    {value: "name-asc", label: "Model A–Z"},
    {value: "name-desc", label: "Model Z–A"},
    {value: "year-desc", label: "Year: newest"},
    {value: "year-asc", label: "Year: oldest"},
    {value: "manufacturer", label: "Manufacturer"},
    {value: "brand", label: "Brand"},
];

function FilterFieldContent({variant, options, selected, onToggle, label, hexBySlug}: {
    variant: Variant;
    options: FacetCount[];
    selected: string[];
    onToggle: (value: string) => void;
    label: string;
    hexBySlug: Map<string, string | null>;
}) {
    if (options.length === 0) return <p className="filterTriggerEmpty">No options</p>;
    if (variant === "pills") return <CategoryPills options={options} selected={selected} onToggle={onToggle}/>;
    if (variant === "swatches") return <ColorSwatchList options={options} selected={selected} onToggle={onToggle} hexBySlug={hexBySlug}/>;
    return <SearchableCheckboxList options={options} selected={selected} onToggle={onToggle} searchLabel={label}/>;
}

// A desktop/tablet popover for one field.
function FilterTrigger({label, variant, options, selected, onToggle, hexBySlug}: {
    label: string;
    variant: Variant;
    options: FacetCount[];
    selected: string[];
    onToggle: (value: string) => void;
    hexBySlug: Map<string, string | null>;
}) {
    const {open, setOpen, ref} = useDetailsPopover();

    return (
        <details ref={ref} className="filterTrigger" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
            <summary className="filterTriggerSummary">
                {label}
                {selected.length > 0 && <span className="filterTriggerCount">{selected.length}</span>}
            </summary>
            <div className="filterTriggerPanel">
                <FilterFieldContent variant={variant} options={options} selected={selected} onToggle={onToggle} label={label} hexBySlug={hexBySlug}/>
            </div>
        </details>
    );
}

// The toolbar's sort dropdown — single-select, closes itself as soon as an option is picked
// (unlike FilterTrigger's checkboxes, which stay open for multiple picks).
function SortTrigger({sort, onChange, showRelevance}: {
    sort: SortOption;
    onChange: (sort: SortOption) => void;
    showRelevance: boolean;
}) {
    const {open, setOpen, ref} = useDetailsPopover();
    const options = showRelevance ? [{value: "relevance" as const, label: "Relevance"}, ...SORT_OPTIONS] : SORT_OPTIONS;
    const currentLabel = options.find((o) => o.value === sort)?.label ?? options[0]!.label;

    return (
        <details ref={ref} className="filterTrigger sortTrigger" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
            <summary className="filterTriggerSummary sortTriggerSummary">Sort: {currentLabel} ▾</summary>
            <div className="filterTriggerPanel">
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`sortOption${option.value === sort ? " sortOptionSelected" : ""}`}
                        onClick={() => {
                            onChange(option.value);
                            setOpen(false);
                        }}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </details>
    );
}

export function CollectionToolbar({filters, facets, resultsCount, onToggle, onClear, sort, onSortChange, hasQuery}: CollectionToolbarProps) {
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const activeCount = GROUPS.reduce((n, {key}) => n + filters[key].length, 0);

    const colorsQuery = useQuery({queryKey: ["colors"], queryFn: getColors});
    const hexBySlug = useMemo(() => new Map((colorsQuery.data ?? []).map((c) => [c.slug, c.hex])), [colorsQuery.data]);

    const closeSheet = () => setIsSheetOpen(false);

    // The "Filters" button/sheet only exists below tablet (640px) — the four triggers are always
    // inline above that. Esc closes the sheet and returns focus to the toggle button; resizing
    // (or rotating) past tablet closes it too, so it can't get stuck open behind the inline row.
    useEffect(() => {
        if (!isSheetOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setIsSheetOpen(false);
            filtersToggleRef.current?.focus();
        };
        document.addEventListener("keydown", onKeyDown);

        const tabletUp = window.matchMedia(MEDIA.tabletUp);
        const onTabletUp = (e: MediaQueryListEvent) => {
            if (e.matches) setIsSheetOpen(false);
        };
        tabletUp.addEventListener("change", onTabletUp);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            tabletUp.removeEventListener("change", onTabletUp);
        };
    }, [isSheetOpen]);

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
                    ref={filtersToggleRef}
                    type="button"
                    className="filtersToggle"
                    onClick={() => setIsSheetOpen((open) => !open)}
                    aria-expanded={isSheetOpen}
                    aria-controls="collectionFilterSheet"
                >
                    <Filter/>
                    Filters
                    {activeCount > 0 && <span className="filtersToggleCount">{activeCount}</span>}
                </button>

                <div className="toolbarTriggers">
                    {GROUPS.map(({key, label, variant}) => (
                        <FilterTrigger
                            key={key}
                            label={label}
                            variant={variant}
                            options={facets[key]}
                            selected={filters[key]}
                            onToggle={(value) => onToggle(key, value)}
                            hexBySlug={hexBySlug}
                        />
                    ))}

                    {activeCount > 0 && (
                        <button type="button" className="clearAllButton" onClick={onClear}>
                            Clear all
                        </button>
                    )}
                </div>

                {/* The results count moved to the page's results header (Phase 17); resultsCount
                    now only feeds the mobile sheet's "Show N models" button. */}
                <div className="toolbarPlaceholders">
                    {/* View modes: visual placeholder only — wired in Phase 18. */}
                    <div className="viewModeGroup" aria-hidden="true">
                        <button type="button" className="viewModeButton viewModeButtonActive" disabled title="Grid view">⊞</button>
                        <button type="button" className="viewModeButton" disabled title="List view — coming soon">☰</button>
                        <button type="button" className="viewModeButton" disabled title="Compact view — coming soon">≡</button>
                    </div>
                    <SortTrigger sort={sort} onChange={onSortChange} showRelevance={hasQuery}/>
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

            {/* Mobile bottom sheet — same content/fields as the desktop triggers above, CSS-only
                below 640px (see CollectionToolbar.css); never rendered/visible at tablet+. */}
            {isSheetOpen && (
                <>
                    <div className="sheetScrim" onClick={closeSheet}/>
                    <div id="collectionFilterSheet" className="filterSheet" role="dialog" aria-modal="true" aria-label="Filters">
                        <div className="sheetHeader">
                            <span className="sheetTitle">Filters</span>
                            {activeCount > 0 && (
                                <button type="button" className="clearAllButton" onClick={onClear}>
                                    Clear all
                                </button>
                            )}
                            <button type="button" className="sheetClose" onClick={closeSheet} aria-label="Close filters">
                                <Close/>
                            </button>
                        </div>

                        <div className="sheetBody">
                            {GROUPS.map(({key, label, variant}) => (
                                <div key={key} className="sheetSection">
                                    <h3 className="sheetSectionTitle">{label}</h3>
                                    <FilterFieldContent
                                        variant={variant}
                                        options={facets[key]}
                                        selected={filters[key]}
                                        onToggle={(value) => onToggle(key, value)}
                                        label={label}
                                        hexBySlug={hexBySlug}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="sheetFooter">
                            <button type="button" className="sheetApplyButton" onClick={closeSheet}>
                                Show {resultsCount} models
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
