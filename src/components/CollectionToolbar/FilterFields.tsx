import {useState} from "react";

import {Check} from "../../icons/Check.tsx";
import {ColorCircle} from "../ColorCircle/ColorCircle.tsx";
import {categoryColorVar} from "../../utils/category.ts";
import {colorSwatchHex} from "../../utils/color.ts";
import type {FacetCount} from "../../services/collection-query.ts";

type ToggleHandler = (value: string) => void;

// Manufacturer and Brand: a search box over a scrollable checkbox list, each row showing its
// facet count (against the *other* active filters — see getFacetCounts()).
export function SearchableCheckboxList({options, selected, onToggle, searchLabel}: {
    options: FacetCount[];
    selected: string[];
    onToggle: ToggleHandler;
    searchLabel: string;
}) {
    const [search, setSearch] = useState("");
    const needle = search.trim().toLowerCase();
    const visible = needle ? options.filter((o) => o.name.toLowerCase().includes(needle)) : options;

    return (
        <div className="fieldList">
            {options.length > 8 && (
                <input
                    type="search"
                    className="fieldSearch"
                    placeholder={`Search ${searchLabel.toLowerCase()}s…`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label={`Search ${searchLabel.toLowerCase()}s`}
                />
            )}
            <div className="fieldListScroll">
                {visible.length === 0 ? (
                    <p className="filterTriggerEmpty">No matches</p>
                ) : (
                    visible.map((option) => (
                        <label key={option.slug} className="filterOption">
                            <input type="checkbox" checked={selected.includes(option.slug)} onChange={() => onToggle(option.slug)}/>
                            <span className="filterOptionName">{option.name}</span>
                            <span className="filterOptionCount">{option.count}</span>
                        </label>
                    ))
                )}
            </div>
        </div>
    );
}

// Category: colored pills (token-driven, same palette as CategoryLabel on the cards) instead of a
// checkbox list — there are only ever a handful of categories.
export function CategoryPills({options, selected, onToggle}: {
    options: FacetCount[];
    selected: string[];
    onToggle: ToggleHandler;
}) {
    return (
        <div className="categoryPills">
            {options.map((option) => {
                const isSelected = selected.includes(option.slug);
                return (
                    <button
                        key={option.slug}
                        type="button"
                        className={`categoryPill${isSelected ? " categoryPillSelected" : ""}`}
                        style={{borderColor: categoryColorVar(option.name), color: categoryColorVar(option.name)}}
                        aria-pressed={isSelected}
                        onClick={() => onToggle(option.slug)}
                    >
                        {isSelected && <Check className="categoryPillCheck" width={12} height={12} aria-hidden="true"/>}
                        {option.name} <span className="filterOptionCount">{option.count}</span>
                    </button>
                );
            })}
        </div>
    );
}

// Color: swatches instead of a name/checkbox row — Multi renders as a generic conic gradient
// (getSwatchBackground(), the same helper ModelCard uses for a multi-color livery dot).
export function ColorSwatchList({options, selected, onToggle, hexBySlug}: {
    options: FacetCount[];
    selected: string[];
    onToggle: ToggleHandler;
    hexBySlug: Map<string, string | null>;
}) {
    return (
        <div className="colorSwatches">
            {options.map((option) => {
                const isSelected = selected.includes(option.slug);
                const hex = hexBySlug.get(option.slug);
                return (
                    <button
                        key={option.slug}
                        type="button"
                        className={`colorSwatchButton${isSelected ? " colorSwatchButtonSelected" : ""}`}
                        aria-pressed={isSelected}
                        onClick={() => onToggle(option.slug)}
                        title={`${option.name} (${option.count})`}
                    >
                        <ColorCircle hex={colorSwatchHex(hex)}/>
                        <span className="colorSwatchName">{option.name}</span>
                        <span className="filterOptionCount">{option.count}</span>
                    </button>
                );
            })}
        </div>
    );
}
