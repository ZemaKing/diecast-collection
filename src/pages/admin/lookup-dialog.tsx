import {useEffect, useId, useRef, useState, type KeyboardEvent} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";

import {ColorCircle} from "../../components/ColorCircle/ColorCircle.tsx";
import {LogoOrText} from "../../components/ModelCard/LogoOrText.tsx";

import {useModalDialog} from "../../hooks/useModalDialog.ts";
import type {AppError} from "../../lib/errors.ts";
import {resizeImage} from "../../lib/image-resize.ts";
import {saveLookup, type LogoChange, type SaveLookupResult} from "../../services/lookup-admin.ts";
import {colorSwatchHex} from "../../utils/color.ts";
import {countryCodeToFlagEmoji} from "../../utils/model-display.ts";
import {
    DEFAULT_COLOR_HEX,
    LOGO_ACCEPT,
    LOGO_MAX_PX,
    LOOKUP_LABELS,
    LOOKUP_NAME_MAX,
    checkLogoFile,
    draftToWrite,
    hasLogo,
    isLookupDraftChanged,
    lookupSlugFor,
    lookupToDraft,
    normalizeCountryCode,
    validateLookupDraft,
    type LookupDraft,
    type LookupKind,
    type LookupRow,
} from "../../utils/lookup-admin.ts";

import "../../components/ConfirmDialog/ConfirmDialog.css";
import "./model-form.css";
import "./lookup-dialog.css";

type LookupDialogProps = {
    kind: LookupKind;
    // null = create a new row.
    editing: LookupRow | null;
    // Create: the name typed into the model form's picker.
    initialName?: string;
    // Every row of that table, for the duplicate checks.
    existing: Pick<LookupRow, "slug" | "name">[];
    onClose: () => void;
    onSaved: (result: SaveLookupResult) => void;
};

// A logo picked in the dialog, already prepared for upload (SVG as is, a raster resized to WebP).
type PendingLogo = Extract<LogoChange, {action: "upload"}> & {previewUrl: string; fileName: string};
type LogoState = {action: "keep"} | {action: "remove"} | PendingLogo;

// Create or edit one brand / manufacturer / driver / tag / color / category (ROADMAP Phase 28).
// Opened from the model form's pickers ("Add “…”") and from /admin/data. The row is written as soon
// as the dialog is saved — it's supporting data, not part of the model — so the form can pick it
// right away. Native modal <dialog> (useModalDialog): mount = open, unmount = close.
export function LookupDialog({kind, editing, initialName = "", existing, onClose, onSaved}: LookupDialogProps) {
    const baseId = useId();
    const queryClient = useQueryClient();
    const labels = LOOKUP_LABELS[kind];
    const [draft, setDraft] = useState<LookupDraft>(() => lookupToDraft(editing, initialName));
    const [showErrors, setShowErrors] = useState(false);
    const [logo, setLogo] = useState<LogoState>({action: "keep"});
    const [logoError, setLogoError] = useState<string | null>(null);
    const [preparingLogo, setPreparingLogo] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const mutation = useMutation<SaveLookupResult, AppError>({
        mutationFn: () => {
            const change: LogoChange = logo.action === "upload"
                ? {action: "upload", blob: logo.blob, ext: logo.ext, contentType: logo.contentType}
                : logo;
            return saveLookup(kind, {editing, write: draftToWrite(kind, draft), logo: change});
        },
        onSuccess: (result) => {
            void queryClient.invalidateQueries({queryKey: [kind]});
            void queryClient.invalidateQueries({queryKey: ["lookup-rows", kind]});
            // A rename / new logo / new swatch shows on every model that uses the row.
            if (editing) {
                void queryClient.invalidateQueries({queryKey: ["models"]});
                void queryClient.invalidateQueries({queryKey: ["model"]});
            }
            onSaved(result);
        },
    });
    const busy = mutation.isPending || preparingLogo;
    const {dialogRef, close, backdropProps} = useModalDialog(() => {
        if (!mutation.isPending) onClose();
    });

    // The preview's object URL lives as long as that pending logo.
    const previewUrl = logo.action === "upload" ? logo.previewUrl : null;
    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    const errors = validateLookupDraft(kind, draft, existing, editing);
    const visibleErrors = showErrors ? errors : {};
    const changed = !editing || logo.action !== "keep" || isLookupDraftChanged(kind, editing, draft);
    const slug = editing?.slug ?? lookupSlugFor(draft.name);
    const set = <K extends keyof LookupDraft>(key: K, value: LookupDraft[K]) => setDraft((d) => ({...d, [key]: value}));
    const fieldId = (name: string) => `${baseId}-${name}`;

    const submit = () => {
        if (busy) return;
        setShowErrors(true);
        const invalid = Object.keys(errors)[0];
        if (invalid) {
            document.getElementById(fieldId(invalid))?.focus();
            return;
        }
        if (!changed) {
            onClose();
            return;
        }
        mutation.mutate();
    };

    // Enter in a text field saves the dialog — and must not reach the model form around it.
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
        if (["checkbox", "file", "color"].includes(event.target.type)) return;
        event.preventDefault();
        event.stopPropagation();
        submit();
    };

    const pickLogo = async (file: File | undefined) => {
        if (!file) return;
        const check = checkLogoFile(file);
        if (!check.ok) {
            setLogoError(check.reason);
            return;
        }
        setLogoError(null);
        try {
            setPreparingLogo(true);
            const prepared = check.format === "svg"
                ? {blob: file as Blob, ext: "svg" as const, contentType: "image/svg+xml"}
                : await resizeImage(file, {maxWidth: LOGO_MAX_PX, quality: 0.9}).then((r) => ({
                    blob: r.blob,
                    ext: r.ext === "jpg" ? ("png" as const) : r.ext,
                    contentType: r.type,
                }));
            setLogo({action: "upload", ...prepared, previewUrl: URL.createObjectURL(prepared.blob), fileName: file.name});
        } catch {
            setLogoError(`${file.name} couldn't be read as an image.`);
        } finally {
            setPreparingLogo(false);
        }
    };

    const currentLogo = logo.action === "upload" ? logo.previewUrl : logo.action === "remove" ? null : editing?.logoPath ?? null;
    const title = editing ? `Edit ${labels.one}` : `New ${labels.one}`;
    const submitLabel = mutation.isPending ? "Saving…" : editing ? "Save changes" : `Add ${labels.one}`;

    return (
        <dialog ref={dialogRef} className="confirmDialog lookupDialog" aria-labelledby={`${baseId}-title`} aria-busy={busy || undefined} {...backdropProps}>
            <div className="confirmDialogInner" onKeyDown={onKeyDown}>
                <h2 id={`${baseId}-title`} className="confirmDialogTitle">{title}</h2>

                <div className="formField">
                    <label htmlFor={fieldId("name")} className="formLabel">
                        Name<span className="formRequired" aria-hidden="true"> *</span>
                    </label>
                    <input
                        id={fieldId("name")}
                        className="formInput"
                        type="text"
                        autoFocus
                        required
                        maxLength={LOOKUP_NAME_MAX[kind]}
                        value={draft.name}
                        aria-invalid={visibleErrors.name ? true : undefined}
                        aria-describedby={`${fieldId("name")}-hint${visibleErrors.name ? ` ${fieldId("name")}-error` : ""}`}
                        onChange={(e) => set("name", e.target.value)}
                    />
                    <p id={`${fieldId("name")}-hint`} className="formHint">
                        {editing
                            ? <>Address <code className="lookupSlug">{slug}</code> stays as it is, so links keep working. {editing.count > 0 && `The new name shows on all ${editing.count} of its models.`}</>
                            : slug
                                ? <>Address: <code className="lookupSlug">{slug}</code> (fixed once added).</>
                                : "The address is made from the name."}
                    </p>
                    {visibleErrors.name && <p id={`${fieldId("name")}-error`} className="formError">{visibleErrors.name}</p>}
                </div>

                {hasLogo(kind) && (
                    <div className="formField">
                        <span className="formLabel" id={fieldId("logo-label")}>Logo</span>
                        <div className="lookupLogoRow">
                            <span className="lookupLogoPreview">
                                <LogoOrText key={currentLogo ?? "none"} logoPath={currentLogo} name={draft.name.trim() || "No logo"} imgClassName="lookupLogoImg" textClassName="lookupLogoText"/>
                            </span>
                            <div className="lookupLogoActions">
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept={LOGO_ACCEPT}
                                    className="visuallyHidden"
                                    tabIndex={-1}
                                    aria-hidden="true"
                                    onChange={(e) => {
                                        void pickLogo(e.target.files?.[0]);
                                        e.target.value = "";
                                    }}
                                />
                                <button type="button" className="formChipButton" aria-describedby={`${fieldId("logo")}-hint`} disabled={busy} onClick={() => fileRef.current?.click()}>
                                    {preparingLogo ? "Preparing…" : currentLogo ? "Replace logo…" : "Upload logo…"}
                                </button>
                                {currentLogo && (
                                    <button type="button" className="formChipButton" disabled={busy} onClick={() => setLogo(editing?.logoPath ? {action: "remove"} : {action: "keep"})}>
                                        Remove logo
                                    </button>
                                )}
                                {logo.action !== "keep" && editing?.logoPath && (
                                    <button type="button" className="formChipButton" disabled={busy} onClick={() => setLogo({action: "keep"})}>
                                        Keep current logo
                                    </button>
                                )}
                            </div>
                        </div>
                        <p id={`${fieldId("logo")}-hint`} className="formHint">
                            {logo.action === "upload" ? `New: ${logo.fileName}. ` : ""}
                            SVG (up to 256 KB), or PNG / JPG / WEBP — resized to {LOGO_MAX_PX} px. Optional: without one, the name is shown.
                        </p>
                        {logoError && <p className="formError" role="alert">{logoError}</p>}
                    </div>
                )}

                {kind === "drivers" && (
                    <div className="formField">
                        <label htmlFor={fieldId("countryCode")} className="formLabel">Country</label>
                        <div className="lookupInline">
                            <input
                                id={fieldId("countryCode")}
                                className="formInput lookupCountry"
                                type="text"
                                maxLength={2}
                                autoCapitalize="characters"
                                spellCheck={false}
                                placeholder="e.g. FI"
                                value={draft.countryCode}
                                aria-invalid={visibleErrors.countryCode ? true : undefined}
                                aria-describedby={`${fieldId("countryCode")}-hint${visibleErrors.countryCode ? ` ${fieldId("countryCode")}-error` : ""}`}
                                onChange={(e) => set("countryCode", e.target.value.toUpperCase())}
                            />
                            {/^[A-Z]{2}$/.test(normalizeCountryCode(draft.countryCode)) && (
                                <span className="lookupFlag" aria-hidden="true">{countryCodeToFlagEmoji(draft.countryCode)}</span>
                            )}
                        </div>
                        <p id={`${fieldId("countryCode")}-hint`} className="formHint">Two-letter code — shows the flag next to the driver. Optional.</p>
                        {visibleErrors.countryCode && <p id={`${fieldId("countryCode")}-error`} className="formError">{visibleErrors.countryCode}</p>}
                    </div>
                )}

                {kind === "colors" && (
                    <fieldset className="formField lookupFieldset">
                        <legend className="formLabel">Swatch</legend>
                        <div className="lookupInline">
                            <span aria-hidden="true">
                                <ColorCircle hex={colorSwatchHex(draft.multiColor ? null : draft.hex)}/>
                            </span>
                            <input
                                id={fieldId("hex")}
                                type="color"
                                className="liveryColor"
                                aria-label="Swatch color"
                                disabled={draft.multiColor}
                                value={(draft.hex || DEFAULT_COLOR_HEX).toLowerCase()}
                                onChange={(e) => set("hex", e.target.value.toUpperCase())}
                            />
                            <label className="lookupCheck">
                                <input type="checkbox" checked={draft.multiColor} onChange={(e) => set("multiColor", e.target.checked)}/>
                                Multi-color (no single swatch)
                            </label>
                        </div>
                        <p className="formHint">The dot in the color filter and the model form. Multi-color shows a rainbow, like “Multi”.</p>
                        {visibleErrors.hex && <p className="formError">{visibleErrors.hex}</p>}
                    </fieldset>
                )}

                {kind === "categories" && (
                    <p className="formHint">A category's color comes from the site's theme, so only its name can change here.</p>
                )}

                {mutation.isError && <p className="confirmDialogError" role="alert">Couldn't save: {mutation.error.message}</p>}

                <div className="confirmDialogActions">
                    <button type="button" className="confirmDialogButton" onClick={close} disabled={mutation.isPending}>Cancel</button>
                    <button type="button" className="confirmDialogButton confirmDialogPrimary" onClick={submit} disabled={busy}>
                        {submitLabel}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
