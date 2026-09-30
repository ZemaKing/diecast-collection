import {useEffect, useId, useRef, useState, type KeyboardEvent} from "react";

import {MarkdownLite} from "../../components/MarkdownLite/MarkdownLite.tsx";
import {Check} from "../../icons/Check.tsx";
import {Close} from "../../icons/Close.tsx";
import {applyMarkdownFormat, type MarkdownFormat} from "../../utils/markdown-lite.ts";
import {MAX_KEY_FEATURES, type ChecklistItem} from "../../utils/model-form.ts";

// The model form's Phase 26 editors: the markdown-lite description, the key-features list and the
// completeness checklist. Pure logic lives in utils (markdown-lite.ts, model-form.ts).

const TOOLBAR: {format: MarkdownFormat; label: string; text: string; shortcut?: string}[] = [
    {format: "bold", label: "Bold", text: "B", shortcut: "b"},
    {format: "italic", label: "Italic", text: "I", shortcut: "i"},
    {format: "bullet", label: "Bulleted list", text: "•"},
    {format: "numbered", label: "Numbered list", text: "1."},
    {format: "link", label: "Link", text: "Link"},
];

type DescriptionEditorProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    maxLength: number;
    invalid?: boolean;
    describedBy?: string;
};

// A textarea with a formatting toolbar that inserts markdown-lite markers (owner's choice: no WYSIWYG,
// nothing but text is ever stored), plus a Write / Preview switch showing exactly what the details
// page will render. Ctrl/⌘+B and Ctrl/⌘+I work in the textarea.
export function DescriptionEditor({id, value, onChange, maxLength, invalid, describedBy}: DescriptionEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [previewing, setPreviewing] = useState(false);
    const toolbarId = useId();

    const apply = (format: MarkdownFormat) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const edit = applyMarkdownFormat(textarea.value, textarea.selectionStart, textarea.selectionEnd, format);
        textarea.focus();
        textarea.setSelectionRange(edit.replaceStart, edit.replaceEnd);
        // insertText keeps the browser's own undo history (Ctrl+Z undoes the formatting); it fires a
        // normal input event, so React's onChange sees the new value. Fallback: set it directly.
        const inserted = typeof document.execCommand === "function" && document.execCommand("insertText", false, edit.text);
        if (!inserted) onChange(textarea.value.slice(0, edit.replaceStart) + edit.text + textarea.value.slice(edit.replaceEnd));
        requestAnimationFrame(() => textarea.setSelectionRange(edit.selectStart, edit.selectEnd));
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
        const tool = TOOLBAR.find((t) => t.shortcut === event.key.toLowerCase());
        if (tool) {
            event.preventDefault();
            apply(tool.format);
        }
    };

    return (
        <div className={`markdownEditor${invalid ? " markdownEditorInvalid" : ""}`}>
            <div className="markdownToolbar" role="toolbar" aria-label="Formatting" aria-controls={id} id={toolbarId}>
                {TOOLBAR.map((tool) => (
                    <button
                        key={tool.format}
                        type="button"
                        className={`markdownTool markdownTool-${tool.format}`}
                        aria-label={tool.shortcut ? `${tool.label} (Ctrl+${tool.shortcut.toUpperCase()})` : tool.label}
                        title={tool.label}
                        disabled={previewing}
                        onClick={() => apply(tool.format)}
                    >
                        {tool.text}
                    </button>
                ))}
                <span className="markdownToolbarSpacer"/>
                <button type="button" className="markdownMode" aria-pressed={previewing} onClick={() => setPreviewing((p) => !p)}>
                    {previewing ? "Edit" : "Preview"}
                </button>
            </div>
            {previewing ? (
                <div className="markdownPreview" aria-live="polite">
                    {value.trim() ? <MarkdownLite source={value}/> : <p className="markdownPreviewEmpty">Nothing to preview yet.</p>}
                </div>
            ) : (
                <textarea
                    ref={textareaRef}
                    id={id}
                    className="markdownTextarea"
                    rows={7}
                    maxLength={maxLength}
                    placeholder="What makes this model special — the real car, the livery, the details of the miniature…"
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={onKeyDown}
                />
            )}
        </div>
    );
}

type KeyFeaturesEditorProps = {
    id: string;
    features: string[];
    onChange: (features: string[]) => void;
    error?: string;
};

// An ordered list of short lines ("Key Features" on the details page): add, edit, reorder with
// buttons (keyboard-friendly — no drag and drop), remove. Enter in a line adds the next one.
export function KeyFeaturesEditor({id, features, onChange, error}: KeyFeaturesEditorProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    // The row to focus once the list has re-rendered (a new row, or the one just moved).
    const pendingFocus = useRef<number | null>(null);
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    const update = (index: number, value: string) => onChange(features.map((f, i) => (i === index ? value : f)));
    const add = (at: number) => {
        if (features.length >= MAX_KEY_FEATURES) return;
        onChange([...features.slice(0, at), "", ...features.slice(at)]);
        pendingFocus.current = at;
    };
    const move = (index: number, delta: -1 | 1) => {
        const next = [...features];
        [next[index], next[index + delta]] = [next[index + delta], next[index]];
        onChange(next);
        pendingFocus.current = index + delta;
    };

    useEffect(() => {
        if (pendingFocus.current === null) return;
        inputRefs.current[pendingFocus.current]?.focus();
        pendingFocus.current = null;
    }, [features]);

    return (
        <fieldset id={id} tabIndex={-1} className="formField featureField" aria-describedby={[hintId, error ? errorId : null].filter(Boolean).join(" ")}>
            <legend className="formLabel">Key Features</legend>
            {features.length > 0 && (
                <ol className="featureRows">
                    {features.map((feature, index) => (
                        <li key={index} className="featureRow">
                            <input
                                ref={(node) => {
                                    inputRefs.current[index] = node;
                                }}
                                className="formInput"
                                type="text"
                                maxLength={200}
                                aria-label={`Key feature ${index + 1}`}
                                placeholder="e.g. Opening doors"
                                value={feature}
                                onChange={(e) => update(index, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") add(index + 1);
                                }}
                            />
                            <button type="button" className="featureButton" aria-label={`Move key feature ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                            <button type="button" className="featureButton" aria-label={`Move key feature ${index + 1} down`} disabled={index === features.length - 1} onClick={() => move(index, 1)}>↓</button>
                            <button type="button" className="featureButton" aria-label={`Remove key feature ${index + 1}`} onClick={() => onChange(features.filter((_, i) => i !== index))}>
                                <Close width={12} height={12}/>
                            </button>
                        </li>
                    ))}
                </ol>
            )}
            {features.length < MAX_KEY_FEATURES && (
                <button type="button" className="formChipButton featureAdd" onClick={() => add(features.length)}>
                    + Add feature
                </button>
            )}
            <p id={hintId} className="formHint">Short points shown as a checklist on the model's page, in this order. Up to {MAX_KEY_FEATURES}; empty lines are ignored.</p>
            {error && <p id={errorId} className="formError">{error}</p>}
        </fieldset>
    );
}

// The mockup's "Checklist": what the model still lacks. Recommended items don't block saving.
export function Checklist({items}: {items: ChecklistItem[]}) {
    const headingId = useId();
    const done = items.filter((i) => i.done).length;
    return (
        <div className="checklist" role="group" aria-labelledby={headingId}>
            <h3 id={headingId} className="checklistTitle">
                Checklist <span className="checklistCount">{done}/{items.length}</span>
            </h3>
            <ul className="checklistItems">
                {items.map((item) => (
                    <li key={item.key} className={`checklistItem${item.done ? " checklistItemDone" : ""}`}>
                        <span className="checklistBox" aria-hidden="true">{item.done && <Check width={12} height={12}/>}</span>
                        <span>
                            {item.label}
                            {item.recommended && <span className="checklistRecommended"> (recommended)</span>}
                            <span className="visuallyHidden">{item.done ? " — done" : " — missing"}</span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
