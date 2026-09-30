import {useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode} from "react";
import {useBlocker, useNavigate} from "react-router-dom";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";

import {ColorCircle} from "../../components/ColorCircle/ColorCircle.tsx";
import {Combobox, type ComboboxItem} from "../../components/Combobox/Combobox.tsx";
import {ConfirmDialog} from "../../components/ConfirmDialog/ConfirmDialog.tsx";
import {DeleteModelDialog} from "../../components/ModelAdminActions/DeleteModelDialog.tsx";
import {PageIntro} from "../../components/PageIntro/PageIntro.tsx";

import {useDebouncedValue} from "../../hooks/useDebouncedValue.ts";
import {Check} from "../../icons/Check.tsx";
import {Close} from "../../icons/Close.tsx";
import type {AppError} from "../../lib/errors.ts";
import {getBrands, getCategories, getColors, getDrivers, getManufacturers} from "../../services/lookups.ts";
import {isSlugTaken, saveModel, type SaveModelResult} from "../../services/model-admin.ts";
import {getModels} from "../../services/models.ts";
import type {Model, ModelSummary} from "../../services/types.ts";
import {colorSwatchHex} from "../../utils/color.ts";
import {countryCodeToFlagEmoji} from "../../utils/model-display.ts";
import {CONDITION_LABELS} from "../../utils/model-details.ts";
import {
    CONDITION_OPTIONS,
    MAX_COLORS,
    MAX_LIVERY,
    NEW_SWATCH_HEX,
    SCALE_OPTIONS,
    firstErrorField,
    generateModelSlug,
    isFormDirty,
    liveryFromColors,
    normalizeHex,
    toSavePayload,
    validateModelForm,
    type LookupChoice,
    type ModelFormErrors,
    type ModelFormField,
    type ModelFormValues,
} from "../../utils/model-form.ts";
import {modelPath, type AdminNoticeState} from "../../utils/model-link.ts";
import {SLUG_PATTERN, slugify} from "../../utils/slug.ts";

import "./model-form.css";

type ModelFormProps = {
    initial: ModelFormValues;
    // null = a new model.
    original: Model | null;
    // Where Cancel goes (the model's page, or the dashboard for a new one).
    cancelTo: string;
};

const SLUG_TAKEN = "Another model already uses this address. Change the name, year or color — or edit the address (e.g. add the racing number).";

// The Create / Edit form (ROADMAP Phase 25, "Diecast Create-Edit.png"): Basic Information,
// Classification, Racing Information (toggle), Condition & Collection. Description & notes, images,
// tags, live preview and the checklist are Phases 26–27. Everything is saved in one call
// (diecast.save_model) — as a draft or published — and an unsaved form never loses work silently:
// leaving asks first (in-app navigation via useBlocker, reload/close via beforeunload).
export function ModelForm({initial, original, cancelTo}: ModelFormProps) {
    const isNew = original === null;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const baseId = useId();
    const fieldId = (field: ModelFormField) => `${baseId}-${field}`;

    const [start] = useState(initial);
    const [values, setValues] = useState(initial);
    // A new model's swatch follows its colors until the owner edits the swatch by hand.
    const [liveryLinked, setLiveryLinked] = useState(isNew && initial.liveryHex.length === 0);
    const [showErrors, setShowErrors] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [currentYear] = useState(() => new Date().getFullYear());
    // Set right before a deliberate navigation (after save/delete) so the guard lets it through.
    const leavingRef = useRef(false);

    const brandsQuery = useQuery({queryKey: ["brands"], queryFn: getBrands});
    const manufacturersQuery = useQuery({queryKey: ["manufacturers"], queryFn: getManufacturers});
    const categoriesQuery = useQuery({queryKey: ["categories"], queryFn: getCategories});
    const colorsQuery = useQuery({queryKey: ["colors"], queryFn: getColors});
    const driversQuery = useQuery({queryKey: ["drivers"], queryFn: getDrivers});
    // Existing series/team/event/location values, offered as suggestions.
    const summariesQuery = useQuery({queryKey: ["models", "cars"], queryFn: getModels});

    const colors = colorsQuery.data ?? [];

    const generatedSlug = generateModelSlug({
        name: values.name,
        year: values.year,
        brand: values.brand?.name ?? null,
        manufacturer: values.manufacturer?.name ?? null,
        color: values.colorSlugs[0] ?? null,
    });
    const current: ModelFormValues = isNew && !values.slugEdited ? {...values, slug: generatedSlug} : values;

    // Live "address already taken" check (new models only); the database re-checks on save.
    const debouncedSlug = useDebouncedValue(current.slug, 400);
    const slugCheckable = isNew && debouncedSlug.length <= 80 && SLUG_PATTERN.test(debouncedSlug);
    const slugQuery = useQuery({
        queryKey: ["slug-taken", debouncedSlug],
        queryFn: () => isSlugTaken(debouncedSlug),
        enabled: slugCheckable,
        staleTime: 0,
    });
    const slugSettled = slugCheckable && debouncedSlug === current.slug && slugQuery.isSuccess;
    const slugTaken = slugSettled && slugQuery.data === true;

    const errors: ModelFormErrors = validateModelForm(current, {isNew, currentYear});
    if (slugTaken && !errors.slug) errors.slug = SLUG_TAKEN;
    // Errors show after the first save attempt; a taken address shows right away.
    const visibleErrors: ModelFormErrors = showErrors ? errors : slugTaken ? {slug: SLUG_TAKEN} : {};
    const errorCount = Object.keys(errors).length;

    const dirty = isFormDirty(start, current);
    const blocker = useBlocker(({currentLocation, nextLocation}) =>
        dirty && !leavingRef.current && currentLocation.pathname !== nextLocation.pathname);

    useEffect(() => {
        if (!dirty) return;
        const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [dirty]);

    const saveMutation = useMutation<SaveModelResult, AppError, boolean>({
        mutationFn: (publish) => saveModel(toSavePayload(current, publish), {originalSlug: original?.slug ?? null}),
        onSuccess: (result, publish) => {
            leavingRef.current = true;
            void queryClient.invalidateQueries({queryKey: ["models"]});
            void queryClient.invalidateQueries({queryKey: ["model", result.slug]});
            queryClient.removeQueries({queryKey: ["slug-taken"]});
            if ([current.brand, current.manufacturer, current.isRacing ? current.driver : null].some((c) => c?.isNew)) {
                for (const key of ["brands", "manufacturers", "drivers"]) void queryClient.invalidateQueries({queryKey: [key]});
            }
            navigate(modelPath(result.slug), {state: {adminNotice: saveNotice(result, publish, original, current.name.trim())} satisfies AdminNoticeState});
        },
    });

    const set = <K extends keyof ModelFormValues>(key: K, value: ModelFormValues[K]) =>
        setValues((v) => ({...v, [key]: value}));

    const focusField = (field: ModelFormField) => {
        const element = document.getElementById(fieldId(field));
        element?.focus();
        element?.scrollIntoView({block: "center"});
    };

    const handleSave = (publish: boolean) => {
        if (saveMutation.isPending) return;
        setShowErrors(true);
        const invalid = firstErrorField(errors);
        if (invalid) {
            focusField(invalid);
            return;
        }
        saveMutation.mutate(publish);
    };

    // Enter in a text field must never save (and publish) the form by accident.
    const onFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
    };

    // ---- colors & swatch ----------------------------------------------------------------------
    const setColors = (colorSlugs: string[]) =>
        setValues((v) => ({...v, colorSlugs, liveryHex: liveryLinked ? liveryFromColors(colorSlugs, colors) : v.liveryHex}));
    const setLivery = (liveryHex: string[]) => {
        setLiveryLinked(false);
        set("liveryHex", liveryHex);
    };

    // ---- options --------------------------------------------------------------------------------
    const lookupOptions = (rows: {slug: string; name: string}[] | undefined): ComboboxItem[] =>
        (rows ?? []).map((r) => ({value: r.slug, label: r.name}));
    const driverOptions: ComboboxItem[] = (driversQuery.data ?? []).map((d) => ({
        value: d.slug,
        label: d.name,
        hint: d.countryCode ? <span aria-hidden="true">{countryCodeToFlagEmoji(d.countryCode)}</span> : undefined,
    }));
    const colorOptions: ComboboxItem[] = colors
        .filter((c) => !values.colorSlugs.includes(c.slug))
        .map((c) => ({value: c.slug, label: c.name, icon: <ColorCircle hex={colorSwatchHex(c.hex)}/>}));
    const scaleOptions = SCALE_OPTIONS.includes(values.scale) ? SCALE_OPTIONS : [...SCALE_OPTIONS, values.scale];
    const suggestions = collectSuggestions(summariesQuery.data);

    const lookupError = [brandsQuery, manufacturersQuery, categoriesQuery, colorsQuery, driversQuery].find((q) => q.isError)?.error;

    const newChoice = (label: string): LookupChoice => ({slug: slugify(label), name: label, isNew: true});
    const choice = (option: ComboboxItem): LookupChoice => ({slug: option.value, name: option.label, isNew: false});

    // Props every field control shares: id, error wiring.
    const control = (field: ModelFormField, hint = false) => {
        const describedBy = [hint ? `${fieldId(field)}-hint` : null, visibleErrors[field] ? `${fieldId(field)}-error` : null].filter(Boolean).join(" ");
        return {
            id: fieldId(field),
            "aria-invalid": visibleErrors[field] ? true : undefined,
            "aria-describedby": describedBy || undefined,
        } as const;
    };

    const title = isNew ? "Add New Model" : "Edit Model";
    const subtitle = isNew ? "Add a new diecast model to your collection." : original.name;
    const labels = isNew
        ? {draft: "Save as Draft", publish: "Save Model"}
        : original.isPublished
            ? {draft: "Move to Drafts", publish: "Save Changes"}
            : {draft: "Save Draft", publish: "Publish"};

    const actions = (
        <FormActions
            labels={labels}
            pending={saveMutation.isPending ? (saveMutation.variables ? "publish" : "draft") : null}
            onCancel={() => navigate(cancelTo)}
            onSave={handleSave}
        />
    );

    return (
        <form className="modelForm" noValidate onSubmit={(event) => event.preventDefault()} onKeyDown={onFormKeyDown} aria-labelledby={`${baseId}-title`}>
            <PageIntro eyebrow="Admin" title={title} subtitle={subtitle} titleId={`${baseId}-title`}>
                {actions}
            </PageIntro>

            {showErrors && errorCount > 0 && (
                <p className="formAlert" role="alert">
                    {errorCount === 1 ? "One field needs attention before saving." : `${errorCount} fields need attention before saving.`}
                </p>
            )}
            {saveMutation.isError && (
                <p className="formAlert" role="alert">Couldn't save: {saveMutation.error.message}</p>
            )}
            {lookupError && (
                <p className="formAlert" role="alert">Some lists couldn't load: {lookupError.message} Reload the page to try again.</p>
            )}

            <div className="modelFormGrid">
                <div className="modelFormMain">
                    <FormSection number={1} title="Basic Information">
                        <div className="formRow formRowName">
                            <Field label="Model Name" required htmlFor={fieldId("name")} error={visibleErrors.name} errorId={`${fieldId("name")}-error`}>
                                <input
                                    {...control("name")}
                                    className="formInput"
                                    type="text"
                                    required
                                    maxLength={120}
                                    placeholder="e.g. Chevrolet Corvette Stingray"
                                    value={values.name}
                                    onChange={(e) => set("name", e.target.value)}
                                />
                            </Field>
                            <Field label="Year" required htmlFor={fieldId("year")} error={visibleErrors.year} errorId={`${fieldId("year")}-error`}>
                                <input
                                    {...control("year")}
                                    className="formInput"
                                    type="number"
                                    inputMode="numeric"
                                    required
                                    min={1885}
                                    max={currentYear + 1}
                                    placeholder="e.g. 2020"
                                    value={values.year}
                                    onChange={(e) => set("year", e.target.value)}
                                />
                            </Field>
                        </div>
                        <div className="formRow formRowHalves">
                            <Field
                                label="Brand"
                                required
                                htmlFor={fieldId("brand")}
                                error={visibleErrors.brand}
                                errorId={`${fieldId("brand")}-error`}
                                hint={values.brand?.isNew ? `“${values.brand.name}” will be added as a new brand (no logo yet).` : undefined}
                                hintId={`${fieldId("brand")}-hint`}
                            >
                                <Combobox
                                    {...lookupControl(control("brand", !!values.brand?.isNew))}
                                    options={lookupOptions(brandsQuery.data)}
                                    value={values.brand?.slug ?? null}
                                    displayLabel={values.brand?.name ?? null}
                                    onSelect={(o) => set("brand", choice(o))}
                                    onCreate={(label) => set("brand", newChoice(label))}
                                    createHint="new brand"
                                    placeholder="Search brands…"
                                />
                            </Field>
                            <Field
                                label="Manufacturer"
                                required
                                htmlFor={fieldId("manufacturer")}
                                error={visibleErrors.manufacturer}
                                errorId={`${fieldId("manufacturer")}-error`}
                                hint={values.manufacturer?.isNew ? `“${values.manufacturer.name}” will be added as a new manufacturer (no logo yet).` : undefined}
                                hintId={`${fieldId("manufacturer")}-hint`}
                            >
                                <Combobox
                                    {...lookupControl(control("manufacturer", !!values.manufacturer?.isNew))}
                                    options={lookupOptions(manufacturersQuery.data)}
                                    value={values.manufacturer?.slug ?? null}
                                    displayLabel={values.manufacturer?.name ?? null}
                                    onSelect={(o) => set("manufacturer", choice(o))}
                                    onCreate={(label) => set("manufacturer", newChoice(label))}
                                    createHint="new manufacturer"
                                    placeholder="Search manufacturers…"
                                />
                            </Field>
                        </div>
                    </FormSection>

                    <FormSection number={2} title="Classification">
                        <div className="formRow formRowQuarters">
                            <Field label="Category" required htmlFor={fieldId("categorySlug")} error={visibleErrors.categorySlug} errorId={`${fieldId("categorySlug")}-error`}>
                                <select
                                    {...control("categorySlug")}
                                    className="formInput formSelect"
                                    required
                                    value={values.categorySlug}
                                    onChange={(e) => set("categorySlug", e.target.value)}
                                >
                                    <option value="" disabled>Choose…</option>
                                    {(categoriesQuery.data ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                                </select>
                            </Field>
                            <Field label="Scale" required htmlFor={fieldId("scale")} error={visibleErrors.scale} errorId={`${fieldId("scale")}-error`}>
                                <select
                                    {...control("scale")}
                                    className="formInput formSelect"
                                    required
                                    value={values.scale}
                                    onChange={(e) => set("scale", e.target.value)}
                                >
                                    {scaleOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </Field>
                            <Field
                                label={values.colorSlugs.length > 1 ? "Colors" : "Color"}
                                required
                                htmlFor={fieldId("colorSlugs")}
                                error={visibleErrors.colorSlugs}
                                errorId={`${fieldId("colorSlugs")}-error`}
                                className="formFieldColors"
                            >
                                {values.colorSlugs.length > 0 && (
                                    <ul className="colorChips" aria-label="Chosen colors, main color first">
                                        {values.colorSlugs.map((slug) => {
                                            const color = colors.find((c) => c.slug === slug);
                                            const name = color?.name ?? slug;
                                            return (
                                                <li key={slug} className="colorChip">
                                                    <ColorCircle hex={colorSwatchHex(color?.hex)}/>
                                                    <span>{name}</span>
                                                    <button
                                                        type="button"
                                                        className="colorChipRemove"
                                                        aria-label={`Remove ${name}`}
                                                        onClick={() => setColors(values.colorSlugs.filter((s) => s !== slug))}
                                                    >
                                                        <Close width={12} height={12}/>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                <Combobox
                                    {...lookupControl(control("colorSlugs"))}
                                    options={colorOptions}
                                    value={null}
                                    displayLabel={null}
                                    onSelect={(o) => setColors([...values.colorSlugs, o.value])}
                                    placeholder={values.colorSlugs.length >= MAX_COLORS ? `Up to ${MAX_COLORS} colors` : values.colorSlugs.length > 0 ? "Add a color…" : "Search colors…"}
                                    disabled={values.colorSlugs.length >= MAX_COLORS}
                                />
                            </Field>
                            <Field label="Series / Collection" htmlFor={fieldId("series")} error={visibleErrors.series} errorId={`${fieldId("series")}-error`}>
                                <input
                                    {...control("series")}
                                    className="formInput"
                                    type="text"
                                    maxLength={120}
                                    list={`${baseId}-series-list`}
                                    placeholder="—"
                                    value={values.series}
                                    onChange={(e) => set("series", e.target.value)}
                                />
                                <Suggestions id={`${baseId}-series-list`} values={suggestions.series}/>
                            </Field>
                        </div>

                        <LiveryEditor
                            id={fieldId("liveryHex")}
                            hex={values.liveryHex}
                            error={visibleErrors.liveryHex}
                            canMatch={values.colorSlugs.length > 0}
                            onChange={setLivery}
                            onMatch={() => setLivery(liveryFromColors(values.colorSlugs, colors))}
                            fallbackHex={liveryFromColors(values.colorSlugs, colors)[0] ?? NEW_SWATCH_HEX}
                        />
                    </FormSection>

                    <FormSection
                        number={3}
                        title="Racing Information"
                        optional
                        highlighted={values.isRacing}
                        aside={<RacingSwitch checked={values.isRacing} onChange={(on) => set("isRacing", on)}/>}
                    >
                        {values.isRacing ? (
                            <div className="formRow formRowQuarters">
                                <Field label="Racing Number" htmlFor={fieldId("carNumber")} error={visibleErrors.carNumber} errorId={`${fieldId("carNumber")}-error`}>
                                    <input
                                        {...control("carNumber")}
                                        className="formInput"
                                        type="text"
                                        maxLength={4}
                                        autoCapitalize="characters"
                                        placeholder="e.g. 67"
                                        value={values.carNumber}
                                        onChange={(e) => set("carNumber", e.target.value.toUpperCase())}
                                    />
                                </Field>
                                <Field
                                    label="Driver"
                                    htmlFor={fieldId("driver")}
                                    error={visibleErrors.driver}
                                    errorId={`${fieldId("driver")}-error`}
                                    hint={values.driver?.isNew ? `“${values.driver.name}” will be added as a new driver.` : undefined}
                                    hintId={`${fieldId("driver")}-hint`}
                                >
                                    <Combobox
                                        {...lookupControl(control("driver", !!values.driver?.isNew))}
                                        options={driverOptions}
                                        value={values.driver?.slug ?? null}
                                        displayLabel={values.driver?.name ?? null}
                                        onSelect={(o) => set("driver", choice(o))}
                                        onCreate={(label) => set("driver", newChoice(label))}
                                        createHint="new driver"
                                        onClear={() => set("driver", null)}
                                        placeholder="Search or add a driver…"
                                    />
                                </Field>
                                <Field label="Team" htmlFor={fieldId("team")} error={visibleErrors.team} errorId={`${fieldId("team")}-error`}>
                                    <input
                                        {...control("team")}
                                        className="formInput"
                                        type="text"
                                        maxLength={120}
                                        list={`${baseId}-team-list`}
                                        placeholder="e.g. Corvette Racing"
                                        value={values.team}
                                        onChange={(e) => set("team", e.target.value)}
                                    />
                                    <Suggestions id={`${baseId}-team-list`} values={suggestions.team}/>
                                </Field>
                                <Field label="Race / Event" htmlFor={fieldId("event")} error={visibleErrors.event} errorId={`${fieldId("event")}-error`}>
                                    <input
                                        {...control("event")}
                                        className="formInput"
                                        type="text"
                                        maxLength={120}
                                        list={`${baseId}-event-list`}
                                        placeholder="e.g. 24h Le Mans"
                                        value={values.event}
                                        onChange={(e) => set("event", e.target.value)}
                                    />
                                    <Suggestions id={`${baseId}-event-list`} values={suggestions.event}/>
                                </Field>
                            </div>
                        ) : (
                            <p className="formSectionNote">
                                Turn on for race and rally cars to add the number, driver, team and event.
                                {hasRacingDetails(values) && " The details entered earlier are kept until you save — saving now removes them."}
                            </p>
                        )}
                    </FormSection>

                    <FormSection number={4} title="Condition & Collection">
                        <div className="formRow formRowThirds">
                            <Field label="Condition" htmlFor={fieldId("condition")} error={visibleErrors.condition} errorId={`${fieldId("condition")}-error`}>
                                <select
                                    {...control("condition")}
                                    className="formInput formSelect"
                                    value={values.condition}
                                    onChange={(e) => set("condition", e.target.value)}
                                >
                                    <option value="">Not set</option>
                                    {CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
                                </select>
                            </Field>
                            <Field label="Added Date" htmlFor={fieldId("addedAt")} error={visibleErrors.addedAt} errorId={`${fieldId("addedAt")}-error`}>
                                <input
                                    {...control("addedAt")}
                                    className="formInput"
                                    type="date"
                                    value={values.addedAt}
                                    onChange={(e) => set("addedAt", e.target.value)}
                                />
                            </Field>
                            <Field label="Location" htmlFor={fieldId("location")} error={visibleErrors.location} errorId={`${fieldId("location")}-error`}>
                                <input
                                    {...control("location")}
                                    className="formInput"
                                    type="text"
                                    maxLength={80}
                                    list={`${baseId}-location-list`}
                                    placeholder="e.g. Display Cabinet"
                                    value={values.location}
                                    onChange={(e) => set("location", e.target.value)}
                                />
                                <Suggestions id={`${baseId}-location-list`} values={suggestions.location}/>
                            </Field>
                        </div>
                    </FormSection>
                </div>

                <aside className="modelFormAside">
                    <section className="formSection" aria-labelledby={`${baseId}-address`}>
                        <h2 id={`${baseId}-address`} className="formAsideTitle">Page address</h2>
                        {isNew ? (
                            <Field
                                label="Address"
                                required
                                htmlFor={fieldId("slug")}
                                error={visibleErrors.slug}
                                errorId={`${fieldId("slug")}-error`}
                                hint="Generated from brand, name, year, manufacturer and main color. It can't change once the model is created."
                                hintId={`${fieldId("slug")}-hint`}
                            >
                                <div className="slugInputRow">
                                    <span className="slugPrefix" aria-hidden="true">/models/</span>
                                    <input
                                        {...control("slug", true)}
                                        className="formInput slugInput"
                                        type="text"
                                        spellCheck={false}
                                        autoCapitalize="none"
                                        maxLength={80}
                                        placeholder="filled in as you type"
                                        value={current.slug}
                                        onChange={(e) => setValues((v) => ({...v, slug: e.target.value.toLowerCase(), slugEdited: true}))}
                                    />
                                </div>
                                <SlugStatus checking={slugCheckable && !slugSettled} available={slugSettled && !slugTaken && !visibleErrors.slug}/>
                                {values.slugEdited && (
                                    <button type="button" className="formTextButton" onClick={() => setValues((v) => ({...v, slug: "", slugEdited: false}))}>
                                        Use the generated address
                                    </button>
                                )}
                            </Field>
                        ) : (
                            <>
                                <p className="slugFixed">/models/{original.slug}</p>
                                <p className="formHint">Fixed since the model was created, so links to it keep working.</p>
                            </>
                        )}
                        <dl className="formStatus">
                            <dt>Status</dt>
                            <dd>{isNew ? "New — not saved yet" : original.isPublished ? "Published" : "Draft — hidden from visitors"}</dd>
                        </dl>
                    </section>

                    {!isNew && (
                        <section className="formSection formDanger" aria-labelledby={`${baseId}-delete`}>
                            <h2 id={`${baseId}-delete`} className="formAsideTitle">Delete model</h2>
                            <p className="formHint">Removes it from the collection with its colors, photos and notes. This can't be undone.</p>
                            <button type="button" className="formButton formButtonDanger" onClick={() => setConfirmingDelete(true)}>
                                Delete model…
                            </button>
                        </section>
                    )}
                </aside>
            </div>

            <div className="modelFormFooter">{actions}</div>

            {confirmingDelete && original && (
                <DeleteModelDialog
                    model={original}
                    onClose={() => setConfirmingDelete(false)}
                    onDeleted={() => {
                        leavingRef.current = true;
                    }}
                />
            )}

            {blocker.state === "blocked" && (
                <ConfirmDialog
                    title="Discard unsaved changes?"
                    confirmLabel="Discard changes"
                    cancelLabel="Keep editing"
                    danger
                    onConfirm={() => blocker.proceed()}
                    onCancel={() => blocker.reset()}
                >
                    <p>{isNew ? "This model hasn't been saved yet." : "Your changes to this model haven't been saved."} Leaving now loses them.</p>
                </ConfirmDialog>
            )}
        </form>
    );
}

// The Combobox takes the same id/error wiring as a native input, under its own prop names.
function lookupControl(props: {id: string; "aria-invalid": true | undefined; "aria-describedby": string | undefined}) {
    return {id: props.id, invalid: props["aria-invalid"], describedBy: props["aria-describedby"]};
}

function hasRacingDetails(values: ModelFormValues): boolean {
    return !!(values.carNumber.trim() || values.driver || values.team.trim() || values.event.trim());
}

function saveNotice(result: SaveModelResult, publish: boolean, original: Model | null, name: string): string {
    if (!result.changed) return "Nothing changed — the model is as it was.";
    if (result.created) return publish ? `Added “${name}” to the collection.` : `Saved “${name}” as a draft — only you can see it.`;
    if (!publish) return original?.isPublished ? `Moved “${name}” to drafts — hidden from visitors.` : "Draft saved.";
    return original?.isPublished ? "Changes saved." : `Published “${name}”.`;
}

type SuggestionLists = {series: string[]; team: string[]; event: string[]; location: string[]};

function collectSuggestions(models: ModelSummary[] | undefined): SuggestionLists {
    const distinct = (pick: (m: ModelSummary) => string | null) =>
        [...new Set((models ?? []).map(pick).map((v) => v?.trim()).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
    return {series: distinct((m) => m.series), team: distinct((m) => m.team), event: distinct((m) => m.event), location: distinct((m) => m.location)};
}

function Suggestions({id, values}: {id: string; values: string[]}) {
    return (
        <datalist id={id}>
            {values.map((v) => <option key={v} value={v}/>)}
        </datalist>
    );
}

function FormActions({labels, pending, onCancel, onSave}: {
    labels: {draft: string; publish: string};
    pending: "draft" | "publish" | null;
    onCancel: () => void;
    onSave: (publish: boolean) => void;
}) {
    return (
        <div className="formActions">
            <button type="button" className="formButton" onClick={onCancel} disabled={pending !== null}>
                <Close width={16} height={16} aria-hidden="true"/>
                Cancel
            </button>
            <button type="button" className="formButton" onClick={() => onSave(false)} disabled={pending !== null}>
                {pending === "draft" ? "Saving…" : labels.draft}
            </button>
            <button type="button" className="formButton formButtonPrimary" onClick={() => onSave(true)} disabled={pending !== null}>
                <Check width={16} height={16} aria-hidden="true"/>
                {pending === "publish" ? "Saving…" : labels.publish}
            </button>
        </div>
    );
}

function FormSection({number, title, optional, highlighted, aside, children}: {
    number: number;
    title: string;
    optional?: boolean;
    highlighted?: boolean;
    aside?: ReactNode;
    children: ReactNode;
}) {
    const headingId = useId();
    return (
        <section className={`formSection${highlighted ? " formSectionHighlighted" : ""}`} aria-labelledby={headingId}>
            <header className="formSectionHead">
                <span className="formSectionNumber" aria-hidden="true">{number}</span>
                <h2 id={headingId} className="formSectionTitle">
                    {title}
                    {optional && <span className="formSectionOptional"> (optional)</span>}
                </h2>
                {aside && <div className="formSectionAside">{aside}</div>}
            </header>
            {children}
        </section>
    );
}

function Field({label, required, htmlFor, error, errorId, hint, hintId, className, children}: {
    label: string;
    required?: boolean;
    htmlFor: string;
    error?: string;
    errorId: string;
    hint?: string;
    hintId?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={`formField${className ? ` ${className}` : ""}`}>
            <label htmlFor={htmlFor} className="formLabel">
                {label}
                {required && <span className="formRequired" aria-hidden="true"> *</span>}
            </label>
            {children}
            {hint && <p id={hintId} className="formHint">{hint}</p>}
            {error && <p id={errorId} className="formError">{error}</p>}
        </div>
    );
}

function RacingSwitch({checked, onChange}: {checked: boolean; onChange: (checked: boolean) => void}) {
    const labelId = useId();
    return (
        <span className="racingSwitch">
            <span id={labelId} className="racingSwitchLabel">This is a racing model</span>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-labelledby={labelId}
                className="switch"
                onClick={() => onChange(!checked)}
            >
                <span className="switchThumb" aria-hidden="true"/>
            </button>
        </span>
    );
}

function SlugStatus({checking, available}: {checking: boolean; available: boolean}) {
    return (
        <p className="slugStatus" role="status">
            {checking ? "Checking…" : available ? <><Check width={14} height={14} aria-hidden="true"/> Available</> : null}
        </p>
    );
}

function LiveryEditor({id, hex, error, canMatch, onChange, onMatch, fallbackHex}: {
    id: string;
    hex: string[];
    error?: string;
    canMatch: boolean;
    onChange: (hex: string[]) => void;
    onMatch: () => void;
    fallbackHex: string;
}) {
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    return (
        <fieldset
            id={id}
            tabIndex={-1}
            className="formField liveryField"
            aria-describedby={[hintId, error ? errorId : null].filter(Boolean).join(" ")}
        >
            <legend className="formLabel">Swatch</legend>
            <div className="liveryRow">
                <span className="liveryPreview" aria-hidden="true">
                    {hex.length > 0 ? <ColorCircle hex={hex}/> : <span className="liveryEmpty"/>}
                </span>
                {hex.map((value, index) => (
                    <span key={index} className="liverySwatch">
                        <input
                            type="color"
                            className="liveryColor"
                            aria-label={`Swatch color ${index + 1}`}
                            value={value.toLowerCase()}
                            onChange={(e) => {
                                const next = normalizeHex(e.target.value);
                                if (next) onChange(hex.map((h, i) => (i === index ? next : h)));
                            }}
                        />
                        <button
                            type="button"
                            className="liveryRemove"
                            aria-label={`Remove swatch color ${index + 1}`}
                            onClick={() => onChange(hex.filter((_, i) => i !== index))}
                        >
                            <Close width={12} height={12}/>
                        </button>
                    </span>
                ))}
                {hex.length < MAX_LIVERY && (
                    <button type="button" className="formChipButton" onClick={() => onChange([...hex, hex[hex.length - 1] ?? fallbackHex])}>
                        + Add color
                    </button>
                )}
                <button type="button" className="formChipButton" onClick={onMatch} disabled={!canMatch}>
                    Match chosen colors
                </button>
            </div>
            <p id={hintId} className="formHint">
                The color dot on cards and the details page — one color is solid, several become slices. Optional.
            </p>
            {error && <p id={errorId} className="formError">{error}</p>}
        </fieldset>
    );
}
