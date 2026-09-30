import {useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode} from "react";

import {ChevronRight} from "../../icons/ChevronRight.tsx";
import {Close} from "../../icons/Close.tsx";
import {
    canCreateOption,
    filterComboboxOptions,
    findExactOption,
    moveActiveIndex,
    type ComboboxOption,
} from "../../utils/combobox.ts";

import "./Combobox.css";

export type ComboboxItem = ComboboxOption & {
    // Leading visual (e.g. a color swatch) and trailing hint (e.g. a flag) in the list.
    icon?: ReactNode;
    hint?: ReactNode;
};

type ComboboxProps = {
    // The <input>'s id — the field's <label htmlFor> points here.
    id: string;
    options: ComboboxItem[];
    // The chosen option's value, or null. A multi-select (colors) keeps this null and shows chips.
    value: string | null;
    // What the input shows while not typing (the chosen option's label; a new, unsaved name too).
    displayLabel: string | null;
    onSelect: (option: ComboboxItem) => void;
    // Enables an "Add “…”" row for text that isn't an option yet.
    onCreate?: (label: string) => void;
    createHint?: string;
    // Optional fields: a clear button, and emptying the text clears the value.
    onClear?: () => void;
    placeholder?: string;
    leading?: ReactNode;
    invalid?: boolean;
    describedBy?: string;
    disabled?: boolean;
};

// An editable combobox with a list popup (WAI-ARIA APG "combobox with list autocomplete"), built by
// hand like the rest of the app's widgets (dialogs, disclosures) — see ROADMAP Phase 25 for why not
// a library. Type to filter (diacritic-insensitive), ↑/↓ to move, Enter to pick, Escape to close,
// Tab/blur keeps the choice. Focus never leaves the input; the active row is announced through
// aria-activedescendant.
export function Combobox({
    id, options, value, displayLabel, onSelect, onCreate, createHint = "new", onClear, placeholder, leading,
    invalid, describedBy, disabled,
}: ComboboxProps) {
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [open, setOpen] = useState(false);
    // null = not typing: the input shows `displayLabel`.
    const [query, setQuery] = useState<string | null>(null);
    const [active, setActive] = useState(-1);

    const filtered = filterComboboxOptions(options, query ?? "");
    const showCreate = !!onCreate && query !== null && canCreateOption(options, query);
    const rowCount = filtered.length + (showCreate ? 1 : 0);
    const optionId = (index: number) => `${listId}-option-${index}`;

    // Keep the active row visible while arrowing through a long list.
    useEffect(() => {
        if (!open || active < 0) return;
        listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({block: "nearest"});
    }, [open, active]);

    const close = () => {
        setOpen(false);
        setActive(-1);
        setQuery(null);
    };

    const openList = (direction: 1 | -1 = 1) => {
        setOpen(true);
        const selected = filtered.findIndex((o) => o.value === value);
        setActive(selected >= 0 ? selected : moveActiveIndex(-1, direction, rowCount));
    };

    const choose = (index: number) => {
        if (index < filtered.length) onSelect(filtered[index]);
        else if (showCreate && query !== null) onCreate?.(query.trim());
        close();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        switch (event.key) {
            case "ArrowDown":
            case "ArrowUp": {
                event.preventDefault();
                const delta = event.key === "ArrowDown" ? 1 : -1;
                if (!open) openList(delta);
                else setActive((current) => moveActiveIndex(current, delta, rowCount));
                break;
            }
            case "Enter":
                // Never let Enter in a picker submit the form.
                event.preventDefault();
                if (open && active >= 0 && active < rowCount) choose(active);
                else if (open && query !== null) {
                    const exact = findExactOption(options, query);
                    if (exact) {
                        onSelect(exact);
                        close();
                    }
                }
                break;
            case "Escape":
                if (open || query !== null) {
                    // Only this popup closes — not a dialog around it.
                    event.preventDefault();
                    event.stopPropagation();
                    close();
                }
                break;
            case "Home":
            case "End":
                if (open && query === null) {
                    event.preventDefault();
                    setActive(event.key === "Home" ? 0 : rowCount - 1);
                }
                break;
        }
    };

    // Leaving the field keeps an exact match of what was typed ("ferrari" → Ferrari), clears an
    // optional field that was emptied, and otherwise restores the previous choice.
    const onBlur = () => {
        if (query !== null) {
            const exact = findExactOption(options, query);
            if (exact && exact.value !== value) onSelect(exact);
            else if (!query.trim() && onClear && value !== null) onClear();
        }
        close();
    };

    const text = query ?? displayLabel ?? "";
    const showLeading = query === null && leading;

    return (
        <div className={`combobox${invalid ? " comboboxInvalid" : ""}${disabled ? " comboboxDisabled" : ""}`}>
            <div className="comboboxField">
                {showLeading && <span className="comboboxLeading" aria-hidden="true">{leading}</span>}
                <input
                    ref={inputRef}
                    id={id}
                    type="text"
                    role="combobox"
                    className="comboboxInput"
                    autoComplete="off"
                    spellCheck={false}
                    aria-autocomplete="list"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    placeholder={placeholder}
                    disabled={disabled}
                    value={text}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                        setActive(event.target.value.trim() ? 0 : -1);
                    }}
                    onKeyDown={onKeyDown}
                    onBlur={onBlur}
                    onClick={() => {
                        if (!open) openList();
                    }}
                />
                {onClear && value !== null && !disabled && (
                    <button
                        type="button"
                        className="comboboxIconButton"
                        aria-label="Clear"
                        // mousedown would blur the input first and commit the typed text.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                            onClear();
                            close();
                            inputRef.current?.focus();
                        }}
                    >
                        <Close width={14} height={14}/>
                    </button>
                )}
                <button
                    type="button"
                    className="comboboxIconButton comboboxToggle"
                    tabIndex={-1}
                    aria-label={open ? "Hide options" : "Show options"}
                    aria-controls={listId}
                    aria-expanded={open}
                    disabled={disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                        if (open) close(); else openList();
                        inputRef.current?.focus();
                    }}
                >
                    <ChevronRight width={16} height={16} className={open ? "comboboxChevronOpen" : "comboboxChevron"}/>
                </button>
            </div>

            <ul ref={listRef} id={listId} role="listbox" className="comboboxList" hidden={!open}>
                {filtered.map((option, index) => (
                    <li
                        key={option.value}
                        id={optionId(index)}
                        data-index={index}
                        role="option"
                        aria-selected={option.value === value}
                        className={`comboboxOption${index === active ? " comboboxOptionActive" : ""}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseMove={() => setActive(index)}
                        onClick={() => choose(index)}
                    >
                        {option.icon && <span className="comboboxOptionIcon" aria-hidden="true">{option.icon}</span>}
                        <span className="comboboxOptionLabel">{option.label}</span>
                        {option.hint && <span className="comboboxOptionHint">{option.hint}</span>}
                    </li>
                ))}
                {showCreate && query !== null && (
                    <li
                        id={optionId(filtered.length)}
                        data-index={filtered.length}
                        role="option"
                        aria-selected={false}
                        className={`comboboxOption comboboxCreate${active === filtered.length ? " comboboxOptionActive" : ""}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseMove={() => setActive(filtered.length)}
                        onClick={() => choose(filtered.length)}
                    >
                        <span className="comboboxOptionLabel">Add “{query.trim()}”</span>
                        <span className="comboboxOptionHint">{createHint}</span>
                    </li>
                )}
                {rowCount === 0 && <li role="presentation" className="comboboxEmpty">No matches</li>}
            </ul>
        </div>
    );
}
