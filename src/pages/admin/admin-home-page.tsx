import {Link, useLocation} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";

import {Header} from "../../components/Header/Header";
import {PageIntro} from "../../components/PageIntro/PageIntro.tsx";
import {ErrorState, Skeleton} from "../../components/States/States.tsx";

import {useModelCount} from "../../hooks/useModelCount.ts";
import {useSession, useSignOut} from "../../hooks/useSession.ts";
import type {AppError} from "../../lib/errors.ts";
import {getDraftModels} from "../../services/models.ts";
import type {ModelSummary} from "../../services/types.ts";
import {editModelPath, modelPath, NEW_MODEL_PATH, readAdminNotice, SUPPORTING_DATA_PATH} from "../../utils/model-link.ts";

import "../collection-page/collection-page.css";
import "../../components/ModelAdminActions/ModelAdminActions.css";
import "./admin-home-page.css";

// `/admin` (ROADMAP Phase 24) — the owner's landing page behind AdminRoute: Add Model (Phase 25),
// and unpublished drafts (RLS shows them to admins only; every public page asks for published
// models explicitly). Edit / Delete live on each model's page, and after a delete the owner lands
// here with the confirmation.
export function AdminHomePage() {
    const session = useSession();
    const count = useModelCount();
    const email = session.status === "signedIn" ? session.user.email : null;

    const draftsQuery = useQuery<ModelSummary[], AppError>({queryKey: ["models", "drafts"], queryFn: getDraftModels});
    const signOutMutation = useSignOut();
    const notice = readAdminNotice(useLocation().state);

    return (
        <div className="layout">
            <Header count={count}/>

            <div className="content">
                <main className="main">
                    <PageIntro eyebrow="Admin" title="Dashboard" subtitle={email ? `Signed in as ${email}` : null}>
                        <div className="adminIntroActions">
                            <Link to={NEW_MODEL_PATH} className="adminPrimary">+ Add Model</Link>
                            <button
                                type="button"
                                className="adminSignOut"
                                onClick={() => signOutMutation.mutate()}
                                disabled={signOutMutation.isPending}
                            >
                                {signOutMutation.isPending ? "Signing out…" : "Sign out"}
                            </button>
                        </div>
                    </PageIntro>

                    {notice && <p className="adminNotice" role="status">{notice}</p>}

                    {signOutMutation.isError && (
                        <p className="adminError" role="alert">{signOutMutation.error.message}</p>
                    )}

                    <div className="adminGrid">
                        <section className="adminCard" aria-labelledby="admin-published">
                            <h2 id="admin-published" className="adminCardTitle">Published</h2>
                            <p className="adminCardValue">{count}</p>
                            <p className="adminCardBody">Models visitors can see. <Link to="/" className="adminLink">Open the collection</Link></p>
                        </section>

                        <section className="adminCard" aria-labelledby="admin-data">
                            <h2 id="admin-data" className="adminCardTitle">Supporting data</h2>
                            <p className="adminCardBody">
                                Brands and manufacturers (with their logos), drivers, tags, colors and categories — rename, add, tidy up.
                            </p>
                            <p className="adminCardBody"><Link to={SUPPORTING_DATA_PATH} className="adminLink">Manage supporting data</Link></p>
                        </section>

                        <section className="adminCard" aria-labelledby="admin-drafts">
                            <h2 id="admin-drafts" className="adminCardTitle">Drafts</h2>
                            {draftsQuery.isPending ? (
                                <Skeleton className="adminCardValueSkeleton"/>
                            ) : draftsQuery.isError ? (
                                <ErrorState compact error={draftsQuery.error} title="Couldn't load drafts" onRetry={() => draftsQuery.refetch()} retrying={draftsQuery.isFetching}/>
                            ) : draftsQuery.data.length === 0 ? (
                                <>
                                    <p className="adminCardValue">0</p>
                                    <p className="adminCardBody">No drafts — every model is published. “Save as Draft” in the model form keeps one here until it's ready.</p>
                                </>
                            ) : (
                                <>
                                    <p className="adminCardValue">{draftsQuery.data.length}</p>
                                    <p className="adminCardBody">Hidden from visitors until published.</p>
                                    <ul className="adminDraftList">
                                        {draftsQuery.data.map((m) => (
                                            <li key={m.slug}>
                                                <Link to={modelPath(m.slug)} className="adminLink">{m.name}</Link>
                                                <span className="adminDraftMeta"> · {m.year} · {m.manufacturer.name} · </span>
                                                <Link to={editModelPath(m.slug)} className="adminLink" aria-label={`Edit ${m.name}`}>Edit</Link>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}
