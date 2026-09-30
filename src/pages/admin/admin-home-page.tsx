import {Link} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";

import {Header} from "../../components/Header/Header";
import {PageIntro} from "../../components/PageIntro/PageIntro.tsx";

import {useModelCount} from "../../hooks/useModelCount.ts";
import {useSession, useSignOut} from "../../hooks/useSession.ts";
import type {AppError} from "../../lib/errors.ts";
import {getDraftModels} from "../../services/models.ts";
import type {ModelSummary} from "../../services/types.ts";
import {modelPath} from "../../utils/model-link.ts";

import "../collection-page/collection-page.css";
import "./admin-home-page.css";

// `/admin` (ROADMAP Phase 24) — the owner's landing page behind AdminRoute. Today it holds the
// one admin-only thing that exists: unpublished drafts (RLS shows them to admins only; every
// public page asks for published models explicitly). The model form (Add / Edit / Delete) lands
// here in Phase 25.
export function AdminHomePage() {
    const session = useSession();
    const count = useModelCount();
    const email = session.status === "signedIn" ? session.user.email : null;

    const draftsQuery = useQuery<ModelSummary[], AppError>({queryKey: ["models", "drafts"], queryFn: getDraftModels});
    const signOutMutation = useSignOut();

    return (
        <div className="layout">
            <Header count={count}/>

            <div className="content">
                <main className="main">
                    <PageIntro eyebrow="Admin" title="Dashboard" subtitle={email ? `Signed in as ${email}` : null}>
                        <button
                            type="button"
                            className="adminSignOut"
                            onClick={() => signOutMutation.mutate()}
                            disabled={signOutMutation.isPending}
                        >
                            {signOutMutation.isPending ? "Signing out…" : "Sign out"}
                        </button>
                    </PageIntro>

                    {signOutMutation.isError && (
                        <p className="adminError" role="alert">{signOutMutation.error.message}</p>
                    )}

                    <div className="adminGrid">
                        <section className="adminCard" aria-labelledby="admin-published">
                            <h2 id="admin-published" className="adminCardTitle">Published</h2>
                            <p className="adminCardValue">{count}</p>
                            <p className="adminCardBody">Models visitors can see. <Link to="/" className="adminLink">Open the collection</Link></p>
                        </section>

                        <section className="adminCard" aria-labelledby="admin-drafts">
                            <h2 id="admin-drafts" className="adminCardTitle">Drafts</h2>
                            {draftsQuery.isPending ? (
                                <p className="adminCardBody">Loading…</p>
                            ) : draftsQuery.isError ? (
                                <p className="adminCardBody">
                                    {draftsQuery.error.message}{" "}
                                    <button type="button" className="adminLinkButton" onClick={() => draftsQuery.refetch()}>Try again</button>
                                </p>
                            ) : draftsQuery.data.length === 0 ? (
                                <>
                                    <p className="adminCardValue">0</p>
                                    <p className="adminCardBody">No drafts — every model is published.</p>
                                </>
                            ) : (
                                <>
                                    <p className="adminCardValue">{draftsQuery.data.length}</p>
                                    <p className="adminCardBody">Hidden from visitors until published.</p>
                                    <ul className="adminDraftList">
                                        {draftsQuery.data.map((m) => (
                                            <li key={m.slug}>
                                                <Link to={modelPath(m.slug)} className="adminLink">{m.name}</Link>
                                                <span className="adminDraftMeta"> · {m.year} · {m.manufacturer.name}</span>
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
