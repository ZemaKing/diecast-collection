import {useEffect, useMemo, useRef, useState} from "react";
import {useQuery} from "@tanstack/react-query";

import {Close} from "../../icons/Close.tsx";
import {Filter} from "../../icons/Filter.tsx";
import {getColors} from "../../services/lookups.ts";
import type {CollectionFilters, FacetCount, FacetCounts} from "../../services/collection-query.ts";
import {MEDIA} from "../../styles/breakpoints.ts";
import {CategoryPills, ColorSwatchList, SearchableCheckboxList} from "./FilterFields.tsx";

import "./CollectionToolbar.css";

type FilterKey = keyof CollectionFilters;
type Variant = "search" | "pills" | "swatches";

type CollectionToolbarProps = {
    filters: CollectionFilters;
    facets: FacetCounts;
    resultsCount: number;
    onToggle: (key: FilterKey, value: string) => void;
    onClear: () => void;
};

const GROUPS: {key: FilterKey; label: string; variant: Variant}[] = [
    {key: "brands", label: "Brand", variant: "search"},
    {key: "manufacturers", label: "Manufacturer", variant: "search"},
    {key: "categories", label: "Category", variant: "pills"},
    {key: "colors", label: "Color", variant: "swatches"},
    // Scale: hidden until a second scale exists in the data (ROADMAP Phase 14).
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

// A desktop/tablet popover for one field. Native <details> gives free keyboard toggling (Enter/
// Space on the summary); Escape-to-close and click-outside-to-close are added on top since
// <details> doesn't support either natively.
function FilterTrigger({label, variant, options, selected, onToggle, hexBySlug}: {
    label: string;
    variant: Variant;
    options: FacetCount[];
    selected: string[];
    onToggle: (value: string) => void;
    hexBySlug: Map<string, string | null>;
}) {
    const [open, setOpen] = useState(false);
    const detailsRef = useRef<HTMLDetailsElement>(null);

    useEffect(() => {
        if (!open) return;

        const onDocumentClick = (e: MouseEvent) => {
            if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setOpen(false);
            detailsRef.current?.querySelector("summary")?.focus();
        };

        document.addEventListener("click", onDocumentClick);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("click", onDocumentClick);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    return (
        <details ref={detailsRef} className="filterTrigger" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
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

export function CollectionToolbar({filters, facets, resultsCount, onToggle, onClear}: CollectionToolbarProps) {
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
