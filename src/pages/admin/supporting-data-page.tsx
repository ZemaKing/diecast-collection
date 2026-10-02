import {useState} from "react";
import {Link, useSearchParams} from "react-router-dom";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";

import {ColorCircle} from "../../components/ColorCircle/ColorCircle.tsx";
import {Combobox, type ComboboxItem} from "../../components/Combobox/Combobox.tsx";
import {ConfirmDialog} from "../../components/ConfirmDialog/ConfirmDialog.tsx";
import {Header} from "../../components/Header/Header";
import {LogoOrText} from "../../components/ModelCard/LogoOrText.tsx";
import {PageIntro} from "../../components/PageIntro/PageIntro.tsx";
import {EmptyState, ErrorState, Skeleton} from "../../components/States/States.tsx";
import {LookupDialog} from "./lookup-dialog.tsx";

import {useModelCount} from "../../hooks/useModelCount.ts";
import type {AppError} from "../../lib/errors.ts";
import {deleteLookup, getLookupRows, mergeDrivers, type MergeDriversResult, type SaveLookupResult} from "../../services/lookup-admin.ts";
import {colorSwatchHex} from "../../utils/color.ts";
import {
    LOOKUP_KINDS,
    LOOKUP_LABELS,
    canCreateLookup,
    deleteBlockedReason,
    filterLookupRows,
    hasLogo,
    lookupCollectionPath,
    parseLookupTab,
    pluralModels,
    type LookupKind,
    type LookupRow,
    type LookupSort,
} from "../../utils/lookup-admin.ts";
import {countryCodeToFlagEmoji} from "../../utils/model-display.ts";
import {SUPPORTING_DATA_PATH} from "../../utils/model-link.ts";

import "../collection-page/collection-page.css";
import "../../components/ModelAdminActions/ModelAdminActions.css";
import "./admin-home-page.css";
import "./model-form.css";
import "./supporting-data-page.css";

// `/admin/data` (ROADMAP Phase 28) — "only as much admin as the form needs": one list per lookup
// table with model counts, add / rename (+ logo, flag, swatch), delete when unused, and the driver
// merge for alias clean-up. Not a CMS: no bulk edits, no free-form columns. The open table is `?tab=`.
export function SupportingDataPage() {
    const count = useModelCount();
    const [searchParams] = useSearchParams();
    const kind = parseLookupTab(searchParams.get("tab"));

    return (
        <div className="layout">
            <Header count={count}/>
            <div className="content">
                <main className="main">
                    <PageIntro
                        eyebrow="Admin"
                        title="Supporting data"
                        subtitle="The brands, manufacturers, drivers, tags, colors and categories models are filed under."
                    >
                        <Link to="/admin" className="adminSignOut dataBack">Dashboard</Link>
                    </PageIntro>

                    <nav className="dataTabs" aria-label="Tables">
                        {LOOKUP_KINDS.map((k) => (
                            <Link
                                key={k}
                                to={k === "brands" ? SUPPORTING_DATA_PATH : `${SUPPORTING_DATA_PATH}?tab=${k}`}
                                replace
                                className="dataTab"
                                aria-current={k === kind ? "page" : undefined}
                            >
                                {LOOKUP_LABELS[k].title}
                            </Link>
                        ))}
                    </nav>

                    {/* Keyed: switching tables starts with a fresh search and no open dialog. */}
                    <LookupPanel key={kind} kind={kind}/>
                </main>
            </div>
        </div>
    );
}

function LookupPanel({kind}: {kind: LookupKind}) {
    const labels = LOOKUP_LABELS[kind];
    const queryClient = useQueryClient();
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<LookupSort>("name");
    const [notice, setNotice] = useState<string | null>(null);
    const [editing, setEditing] = useState<LookupRow | "new" | null>(null);
    const [deleting, setDeleting] = useState<LookupRow | null>(null);
    const [merging, setMerging] = useState<LookupRow | null>(null);

    const rowsQuery = useQuery<LookupRow[], AppError>({queryKey: ["lookup-rows", kind], queryFn: () => getLookupRows(kind)});
    const rows = rowsQuery.data ?? [];
    const visible = filterLookupRows(rows, query, sort);

    const refresh = () => {
        void queryClient.invalidateQueries({queryKey: ["lookup-rows", kind]});
        void queryClient.invalidateQueries({queryKey: [kind]});
    };

    const deleteMutation = useMutation<{orphanedFiles: string[]}, AppError, LookupRow>({
        mutationFn: (row) => deleteLookup(kind, row),
        onSuccess: (result, row) => {
            refresh();
            setDeleting(null);
            setNotice(`Deleted “${row.name}”.${orphanNote(result.orphanedFiles)}`);
        },
    });

    const onSaved = (result: SaveLookupResult) => {
        const created = editing === "new";
        setEditing(null);
        setNotice(`${created ? "Added" : "Saved"} “${result.row.name}”.${orphanNote(result.orphanedFiles)}`);
    };

    return (
        <section className="dataPanel" aria-labelledby="data-panel-title">
            <div className="dataToolbar">
                <h2 id="data-panel-title" className="dataPanelTitle">
                    {labels.title}
                    {rowsQuery.isSuccess && <span className="dataPanelCount"> · {rows.length}</span>}
                </h2>
                <label className="visuallyHidden" htmlFor="data-search">Search {labels.many}</label>
                <input
                    id="data-search"
                    className="formInput dataSearch"
                    type="search"
                    placeholder={`Search ${labels.many}…`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <label className="visuallyHidden" htmlFor="data-sort">Order</label>
                <select id="data-sort" className="formInput formSelect dataSort" value={sort} onChange={(e) => setSort(e.target.value as LookupSort)}>
                    <option value="name">A–Z</option>
                    <option value="count">Most models</option>
                </select>
                {canCreateLookup(kind) && (
                    <button type="button" className="adminPrimary dataAdd" onClick={() => setEditing("new")}>
                        + Add {labels.one}
                    </button>
                )}
            </div>

            <div role="status">{notice && <p className="adminNotice">{notice}</p>}</div>

            {rowsQuery.isPending ? (
                <div className="dataLoading" aria-busy="true">
                    <span className="visuallyHidden" role="status">Loading {labels.many}…</span>
                    {["a", "b", "c", "d", "e"].map((key) => <Skeleton key={key} className="dataLoadingRow"/>)}
                </div>
            ) : rowsQuery.isError ? (
                <ErrorState compact error={rowsQuery.error} title={`Couldn't load ${labels.many}`} onRetry={() => rowsQuery.refetch()} retrying={rowsQuery.isFetching}/>
            ) : visible.length === 0 ? (
                <EmptyState compact title={query.trim() ? `No ${labels.many} match “${query.trim()}”` : `No ${labels.many} yet`}/>
            ) : (
                <table className="dataTable">
                    <caption className="visuallyHidden">{labels.title}{query.trim() ? `, matching “${query.trim()}”` : ""}</caption>
                    <thead>
                        <tr>
                            <th scope="col">Name</th>
                            <th scope="col" className="dataColAddress">Address</th>
                            <th scope="col" className="dataColCount">Models</th>
                            <th scope="col"><span className="visuallyHidden">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((row) => (
                            <LookupTableRow
                                key={row.slug}
                                kind={kind}
                                row={row}
                                onEdit={() => setEditing(row)}
                                onDelete={() => setDeleting(row)}
                                onMerge={() => setMerging(row)}
                            />
                        ))}
                    </tbody>
                </table>
            )}

            {editing && (
                <LookupDialog
                    kind={kind}
                    editing={editing === "new" ? null : editing}
                    existing={rows}
                    onClose={() => setEditing(null)}
                    onSaved={onSaved}
                />
            )}

            {deleting && (
                <ConfirmDialog
                    title={`Delete “${deleting.name}”?`}
                    confirmLabel={deleteMutation.isPending ? "Deleting…" : `Delete ${labels.one}`}
                    danger
                    busy={deleteMutation.isPending}
                    error={deleteMutation.isError ? deleteMutation.error.message : null}
                    onConfirm={() => deleteMutation.mutate(deleting)}
                    onCancel={() => {
                        deleteMutation.reset();
                        setDeleting(null);
                    }}
                >
                    <p>No model uses it, so nothing else changes.{hasLogo(kind) && deleting.logoPath ? " An uploaded logo is deleted with it." : ""}</p>
                </ConfirmDialog>
            )}

            {merging && (
                <MergeDriversDialog
                    from={merging}
                    drivers={rows}
                    onClose={() => setMerging(null)}
                    onMerged={(result) => {
                        setMerging(null);
                        setNotice(`Merged “${result.from}” into “${result.into}” — ${pluralModels(result.moved)} moved.`);
                    }}
                />
            )}
        </section>
    );
}

function LookupTableRow({kind, row, onEdit, onDelete, onMerge}: {
    kind: LookupKind;
    row: LookupRow;
    onEdit: () => void;
    onDelete: () => void;
    onMerge: () => void;
}) {
    const collectionPath = row.count > 0 ? lookupCollectionPath(kind, row.slug) : null;
    const blocked = deleteBlockedReason(kind, row);

    return (
        <tr>
            <th scope="row" className="dataName">
                <span className="dataNameInner">
                    {hasLogo(kind) && (
                        <span className="dataLogo">
                            <LogoOrText logoPath={row.logoPath} name="—" imgClassName="dataLogoImg" textClassName="dataLogoNone"/>
                        </span>
                    )}
                    {kind === "colors" && <ColorCircle hex={colorSwatchHex(row.hex)}/>}
                    <span>{row.name}</span>
                    {kind === "drivers" && row.countryCode && (
                        <span className="dataFlag" title={row.countryCode}>
                            <span aria-hidden="true">{countryCodeToFlagEmoji(row.countryCode)}</span>
                            <span className="visuallyHidden">{row.countryCode}</span>
                        </span>
                    )}
                </span>
            </th>
            <td className="dataColAddress"><code className="lookupSlug">{row.slug}</code></td>
            <td className="dataColCount">
                {collectionPath
                    ? <Link to={collectionPath} className="adminLink" aria-label={`${pluralModels(row.count)} — show in the collection`}>{row.count}</Link>
                    : row.count}
            </td>
            <td className="dataActions">
                <button type="button" className="formChipButton" onClick={onEdit} aria-label={`Edit ${row.name}`}>Edit</button>
                {kind === "drivers" && (
                    <button type="button" className="formChipButton" onClick={onMerge} aria-label={`Merge ${row.name} into another driver`}>Merge…</button>
                )}
                {blocked ? (
                    kind !== "categories" && <span className="dataInUse" title={blocked}>In use<span className="visuallyHidden"> — {blocked}</span></span>
                ) : (
                    <button type="button" className="formChipButton dataDelete" onClick={onDelete} aria-label={`Delete ${row.name}`}>Delete</button>
                )}
            </td>
        </tr>
    );
}

// The alias clean-up (docs/SCHEMA.md D5): every model of `from` gets the chosen driver, then `from`
// is deleted — one transaction (diecast.merge_drivers).
function MergeDriversDialog({from, drivers, onClose, onMerged}: {
    from: LookupRow;
    drivers: LookupRow[];
    onClose: () => void;
    onMerged: (result: MergeDriversResult) => void;
}) {
    const queryClient = useQueryClient();
    const [into, setInto] = useState<LookupRow | null>(null);
    const [missing, setMissing] = useState(false);
    const mutation = useMutation<MergeDriversResult, AppError, LookupRow>({
        mutationFn: (target) => mergeDrivers(from.slug, target.slug),
        onSuccess: (result) => {
            for (const key of [["lookup-rows", "drivers"], ["drivers"], ["models"], ["model"]]) void queryClient.invalidateQueries({queryKey: key});
            onMerged(result);
        },
    });
    const options: ComboboxItem[] = drivers
        .filter((d) => d.slug !== from.slug)
        .map((d) => ({value: d.slug, label: d.name, hint: d.count > 0 ? pluralModels(d.count) : undefined}));

    return (
        <ConfirmDialog
            title={`Merge “${from.name}”`}
            confirmLabel={mutation.isPending ? "Merging…" : "Merge drivers"}
            busy={mutation.isPending}
            error={mutation.isError ? mutation.error.message : missing ? "Choose the driver to keep." : null}
            onConfirm={() => {
                if (into) mutation.mutate(into);
                else setMissing(true);
            }}
            onCancel={onClose}
        >
            <p>
                For duplicates and spellings of the same person. {from.count > 0 ? `Its ${pluralModels(from.count)} will` : "Its models would"} show
                the driver you keep, and “{from.name}” is deleted. This can't be undone.
            </p>
            <div className="formField">
                <label htmlFor="merge-into" className="formLabel">Keep</label>
                <Combobox
                    id="merge-into"
                    options={options}
                    value={into?.slug ?? null}
                    displayLabel={into?.name ?? null}
                    onSelect={(o) => {
                        setInto(drivers.find((d) => d.slug === o.value) ?? null);
                        setMissing(false);
                    }}
                    placeholder="Search drivers…"
                />
            </div>
        </ConfirmDialog>
    );
}

function orphanNote(files: string[]): string {
    return files.length ? ` The old logo file couldn't be deleted from storage (${files.join(", ")}) — delete it in the Supabase dashboard.` : "";
}
