import {useEffect, useId, useMemo, useRef, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Link} from "react-router-dom";

import {ChevronDown} from "../../icons/ChevronDown.tsx";
import {ChevronRight} from "../../icons/ChevronRight.tsx";

import {Close} from "../../icons/Close.tsx";
import {Filter} from "../../icons/Filter.tsx";
import {ViewCompact} from "../../icons/ViewCompact.tsx";
import {ViewGrid} from "../../icons/ViewGrid.tsx";
import {ViewList} from "../../icons/ViewList.tsx";
import {useFocusTrap} from "../../hooks/useFocusTrap.ts";
import {getColors} from "../../services/lookups.ts";
import type {BrowseKind} from "../../services/browse.ts";
import type {CollectionFilters, FacetCount, FacetCounts, SortOption} from "../../services/collection-query.ts";
import {MEDIA} from "../../styles/breakpoints.ts";
import {BROWSE_LABELS, browseIndexPath} from "../../utils/browse-link.ts";
import type {ViewMode} from "../../utils/view-mode.ts";
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
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
};

// `browse`: the field ends with a link to that dimension's index page (Phase 22).
const GROUPS: {key: FilterKey; label: string; variant: Variant; browse?: BrowseKind}[] = [
    {key: "brands", label: "Brand", variant: "search", browse: "brands"},
    {key: "manufacturers", label: "Manufacturer", variant: "search", browse: "manufacturers"},
    {key: "categories", label: "Category", variant: "pills"},
    {key: "colors", label: "Color", variant: "swatches"},
    // Scale: hidden until a second scale exists in the data (ROADMAP Phase 14).
];

const VIEW_MODE_OPTIONS: {value: ViewMode; label: string; Icon: typeof ViewGrid}[] = [
    {value: "grid", label: "Grid view", Icon: ViewGrid},
    {value: "list", label: "List view", Icon: ViewList},
    {value: "compact", label: "Compact view", Icon: ViewCompact},
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

function FilterFieldContent({variant, options, selected, onToggle, label, hexBySlug, browse}: {
    variant: Variant;
    options: FacetCount[];
    selected: string[];
    onToggle: (value: string) => void;
    label: string;
    hexBySlug: Map<string, string | null>;
    browse?: BrowseKind;
}) {
    if (options.length === 0) return <p className="filterTriggerEmpty">No options</p>;
    if (variant === "pills") return <CategoryPills options={options} selected={selected} onToggle={onToggle}/>;
    if (variant === "swatches") return <ColorSwatchList options={options} selected={selected} onToggle={onToggle} hexBySlug={hexBySlug}/>;
    return (
        <>
            <SearchableCheckboxList options={options} selected={selected} onToggle={onToggle} searchLabel={label}/>
            {browse && (
                <Link to={browseIndexPath(browse)} className="filterBrowseLink">
                    Browse all {BROWSE_LABELS[browse].plural.toLowerCase()}
                    <ChevronRight width={14} height={14}/>
                </Link>
            )}
        </>
    );
}

// Grid / List / Compact (ROADMAP Phase 18). A toggle-button group: each button reports its own
// pressed state, so screen readers hear "Grid view, pressed".
function ViewModeSwitcher({viewMode, onChange}: {viewMode: ViewMode; onChange: (mode: ViewMode) => void}) {
    return (
        <div className="viewModeGroup" role="group" aria-label="View">
            {VIEW_MODE_OPTIONS.map(({value, label, Icon}) => (
                <button
                    key={value}
                    type="button"
                    className={`viewModeButton${value === viewMode ? " viewModeButtonActive" : ""}`}
                    aria-pressed={value === viewMode}
                    aria-label={label}
                    title={label}
                    onClick={() => onChange(value)}
                >
                    <Icon aria-hidden="true"/>
                </button>
            ))}
        </div>
    );
}

// A desktop/tablet popover for one field.
function FilterTrigger({label, variant, options, selected, onToggle, hexBySlug, browse}: {
    label: string;
    browse?: BrowseKind;
    variant: Variant;
    options: FacetCount[];
    selected: string[];
    onToggle: (value: string) => void;
    hexBySlug: Map<string, string | null>;
}) {
    const {open, setOpen, ref} = useDetailsPopover();

    return (
        <details ref={ref} className={`filterTrigger${selected.length > 0 ? " filterTriggerActive" : ""}`} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
            <summary className="filterTriggerSummary">
                {label}
                {selected.length > 0 && (
                    <span className="filterTriggerCount">
                        {selected.length}<span className="visuallyHidden"> selected</span>
                    </span>
                )}
                <ChevronDown className="filterTriggerChevron"/>
            </summary>
            <div className="filterTriggerPanel">
                <FilterFieldContent variant={variant} options={options} selected={selected} onToggle={onToggle} label={label} hexBySlug={hexBySlug} browse={browse}/>
            </div>
        </details>
    );
}

// The toolbar's sort dropdown — single-select, closes itself as soon as an option is picked
// (unlike FilterTrigger's checkboxes, which stay open for multiple picks). Also used by the
// brand/manufacturer pages (Phase 22), which hide the sort that's constant on their page.
export function SortTrigger({sort, onChange, showRelevance, hiddenOptions = []}: {
    sort: SortOption;
    onChange: (sort: SortOption) => void;
    showRelevance: boolean;
    hiddenOptions?: SortOption[];
}) {
    const {open, setOpen, ref} = useDetailsPopover();
    const options = (showRelevance ? [{value: "relevance" as const, label: "Relevance"}, ...SORT_OPTIONS] : SORT_OPTIONS)
        .filter((o) => !hiddenOptions.includes(o.value));
    const currentLabel = options.find((o) => o.value === sort)?.label ?? options[0]!.label;

    return (
        <details ref={ref} className="filterTrigger sortTrigger" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
            {/* Below tablet the current option is visually hidden (the mobile mockup shows just
                "Sort"), which leaves room for the view-mode buttons on a 360px row. */}
            <summary className="filterTriggerSummary sortTriggerSummary">
                {/* One inline span, so the summary's flex gap doesn't split "Sort" from ": …". */}
                <span>Sort<span className="sortTriggerCurrent">: {currentLabel}</span></span>
                <ChevronDown className="filterTriggerChevron"/>
            </summary>
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

export function CollectionToolbar({filters, facets, resultsCount, onToggle, onClear, sort, onSortChange, hasQuery, viewMode, onViewModeChange}: CollectionToolbarProps) {
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);
    const sheetTitleId = useId();
    const activeCount = GROUPS.reduce((n, {key}) => n + filters[key].length, 0);

    const colorsQuery = useQuery({queryKey: ["colors"], queryFn: getColors});
    const hexBySlug = useMemo(() => new Map((colorsQuery.data ?? []).map((c) => [c.slug, c.hex])), [colorsQuery.data]);

    const closeSheet = () => setIsSheetOpen(false);

    // The sheet is modal (scrim): focus moves into it, Tab stays inside, Escape closes it, and
    // every way of closing returns focus to the Filters button (Phase 34).
    useFocusTrap({active: isSheetOpen, containerRef: sheetRef, onEscape: closeSheet});

    // The "Filters" button/sheet only exists below desktop (1024px; a bottom sheet on phones, a side
    // sheet on tablets — Phase 31) — the four triggers are inline above that. Resizing (or rotating)
    // into desktop closes it, so it can't get stuck open behind the inline row.
    useEffect(() => {
        if (!isSheetOpen) return;

        const desktopUp = window.matchMedia(MEDIA.desktopUp);
        const onDesktopUp = (e: MediaQueryListEvent) => {
            if (e.matches) setIsSheetOpen(false);
        };
        desktopUp.addEventListener("change", onDesktopUp);

        return () => desktopUp.removeEventListener("change", onDesktopUp);
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
                    className={`filtersToggle${activeCount > 0 ? " filtersToggleActive" : ""}`}
                    onClick={() => setIsSheetOpen((open) => !open)}
                    aria-expanded={isSheetOpen}
                    aria-controls="collectionFilterSheet"
                >
                    <Filter/>
                    Filters
                    {activeCount > 0 && (
                        <span className="filtersToggleCount">
                            {activeCount}<span className="visuallyHidden"> active</span>
                        </span>
                    )}
                </button>

                <div className="toolbarTriggers">
                    {GROUPS.map(({key, label, variant, browse}) => (
                        <FilterTrigger
                            key={key}
                            label={label}
                            variant={variant}
                            browse={browse}
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
                <div className="toolbarEnd">
                    <ViewModeSwitcher viewMode={viewMode} onChange={onViewModeChange}/>
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
                            {chip.name} <Close width={14} height={14} aria-hidden="true"/>
                            <span className="visuallyHidden">Remove {chip.name} filter</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Bottom sheet (phone) / side sheet (tablet) — same content/fields as the desktop
                triggers above (see CollectionToolbar.css); never visible at desktop. */}
            {isSheetOpen && (
                <>
                    <div className="sheetScrim" onClick={closeSheet}/>
                    <div ref={sheetRef} id="collectionFilterSheet" className="filterSheet" role="dialog" aria-modal="true" aria-labelledby={sheetTitleId}>
                        <div className="sheetHeader">
                            <h2 id={sheetTitleId} className="sheetTitle">Filters</h2>
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
                            {GROUPS.map(({key, label, variant, browse}) => (
                                <div key={key} className="sheetSection">
                                    <h3 className="sheetSectionTitle">{label}</h3>
                                    <FilterFieldContent
                                        variant={variant}
                                        options={facets[key]}
                                        selected={filters[key]}
                                        onToggle={(value) => onToggle(key, value)}
                                        label={label}
                                        hexBySlug={hexBySlug}
                                        browse={browse}
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
