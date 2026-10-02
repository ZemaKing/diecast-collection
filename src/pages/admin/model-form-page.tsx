import {useState} from "react";
import {useParams} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";

import {Breadcrumb} from "../../components/Breadcrumb/Breadcrumb.tsx";
import {Header} from "../../components/Header/Header";
import {ErrorState} from "../../components/States/States.tsx";
import {NotFoundPage} from "../not-found-page/not-found-page";
import {ModelForm} from "./model-form.tsx";

import {useModelCount} from "../../hooks/useModelCount.ts";
import type {AppError} from "../../lib/errors.ts";
import {getPrivateNotes} from "../../services/model-admin.ts";
import {getModelBySlug} from "../../services/models.ts";
import type {Model} from "../../services/types.ts";
import {emptyModelForm, localDateString, modelToFormValues} from "../../utils/model-form.ts";
import {modelPath} from "../../utils/model-link.ts";

import "../collection-page/collection-page.css";

// `/admin/models/new` (Phase 25) — behind AdminRoute. A new model is added today unless changed.
export function NewModelPage() {
    const count = useModelCount();
    const [initial] = useState(() => emptyModelForm(localDateString(new Date())));

    return (
        <div className="layout">
            <Header count={count}/>
            <div className="content">
                <Breadcrumb home={{to: "/"}} trail={[{label: "Dashboard", to: "/admin"}, {label: "Add Model"}]}/>
                <main className="main">
                    <ModelForm initial={initial} original={null} cancelTo="/admin"/>
                </main>
            </div>
        </div>
    );
}

// `/admin/models/:slug/edit` (Phase 25). Reads the same ["model", slug] cache as the details page,
// so arriving from there is instant. Drafts load too — RLS shows them to the admin. The private
// notes (Phase 26) are a second, admin-only read; the form waits for both, so its starting values
// (what "unsaved changes" compares against) are complete.
export function EditModelPage() {
    const {slug = ""} = useParams();
    const count = useModelCount();
    const modelQuery = useQuery<Model, AppError>({
        queryKey: ["model", slug],
        queryFn: () => getModelBySlug(slug),
        retry: (failureCount, error) => error.kind !== "not_found" && failureCount < 1,
        // The form holds its own copy while editing; a refetch mustn't look like a change underneath it.
        refetchOnWindowFocus: false,
    });

    const notesQuery = useQuery<string | null, AppError>({
        queryKey: ["model-notes", slug],
        queryFn: () => getPrivateNotes(modelQuery.data!.id),
        enabled: !!modelQuery.data,
        refetchOnWindowFocus: false,
    });

    if (modelQuery.error?.kind === "not_found") return <NotFoundPage/>;

    const model = modelQuery.data;
    const error = modelQuery.error ?? notesQuery.error;

    return (
        <div className="layout">
            <Header count={count}/>
            <div className="content">
                <Breadcrumb
                    home={{to: "/"}}
                    trail={model ? [{label: model.name, to: modelPath(model.slug)}, {label: "Edit"}] : [{label: "Edit"}]}
                />
                <main className="main">
                    {error ? (
                        <ErrorState
                            error={error}
                            title="Couldn't load this model"
                            onRetry={() => (modelQuery.isError ? modelQuery.refetch() : notesQuery.refetch())}
                            retrying={modelQuery.isFetching || notesQuery.isFetching}
                        />
                    ) : !model || notesQuery.isPending ? (
                        <p className="formLoading" role="status">Loading model…</p>
                    ) : (
                        // Keyed by slug: a different model is a fresh form, never a merge into this one.
                        <ModelForm key={model.slug} initial={modelToFormValues(model, notesQuery.data)} original={model} cancelTo={modelPath(model.slug)}/>
                    )}
                </main>
            </div>
        </div>
    );
}
