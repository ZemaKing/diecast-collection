import {useId, useRef, useState, type KeyboardEvent, type ReactNode} from "react";
import {Link, useLocation, useParams, useSearchParams} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";

import {Header} from "../../components/Header/Header";
import {CategoryLabel} from "../../components/CategoryLabel/CategoryLabel";
import {ColorCircle} from "../../components/ColorCircle/ColorCircle";
import {LogoOrText} from "../../components/ModelCard/LogoOrText.tsx";
import {NotFoundPage} from "../not-found-page/not-found-page";

import {useScrollRestoration} from "../../hooks/useScrollRestoration.ts";
import {Calendar} from "../../icons/Calendar.tsx";
import {Car} from "../../icons/Car.tsx";
import {Check} from "../../icons/Check.tsx";
import {ChevronRight} from "../../icons/ChevronRight.tsx";
import {Home} from "../../icons/Home.tsx";
import {Scale} from "../../icons/Scale.tsx";
import type {AppError} from "../../lib/errors.ts";
import {getModelBySlug, getModels} from "../../services/models.ts";
import type {Model, ModelImage} from "../../services/types.ts";
import {countryCodeToFlagEmoji, logoSrc} from "../../utils/model-display.ts";
import {
    formatColors,
    getAvailableTabs,
    getCollectionFacts,
    getRacingSpecs,
    resolveTab,
    tabLabel,
    type DetailTab,
    type SpecRow,
} from "../../utils/model-details.ts";
import {collectionPath, readCollectionSearch, type ModelLinkState} from "../../utils/model-link.ts";

// The page reuses the card's photo badges (manufacturer/scale) and skeleton shimmer — imported
// explicitly, since a direct load of /models/:slug never renders a ModelCard.
// Likewise the collection page's container/error styles (`.layout`, `.content`, `.contentError`).
import "../../components/ModelCard/ModelCard.css";
import "../collection-page/collection-page.css";
import "./model-details-page.css";

// The model details page (ROADMAP Phase 19), `/models/:slug` — replaces the `?model=` modal
// deep link. Every section below renders only when its data exists (docs/SCHEMA.md principle 4:
// nothing is fabricated), so the 227 imported models — which have no description, features,
// tags or condition yet — get a complete-looking page made of what they do have.
//
// Deliberately not rendered (see the Phase 19 notes in ROADMAP.md):
// - the heart / "Add to Collection" button — its meaning on a single-owner site is still open;
// - the "Notes" tab and the "Collected" badge — notes are admin-private, and every model is owned;
// - admin Edit / Delete / "…" — there is no auth yet; they go in the header's action slot below in
//   Phases 24/25, visible to the admin only.

const TAB_PARAM = "tab";

function collectionFilterPath(key: "brand" | "manufacturer" | "category", slug: string): string {
    return `/?${key}=${encodeURIComponent(slug)}`;
}

export function ModelDetailsPage() {
    const {slug = ""} = useParams();
    const location = useLocation();

    const summariesQuery = useQuery({queryKey: ["models", "cars"], queryFn: getModels});
    const modelQuery = useQuery<Model, AppError>({
        queryKey: ["model", slug],
        queryFn: () => getModelBySlug(slug),
        // An unknown slug is a definitive answer — retrying it only delays the 404.
        retry: (failureCount, error) => error.kind !== "not_found" && failureCount < 1,
    });

    useScrollRestoration({ready: !modelQuery.isPending});

    if (modelQuery.error?.kind === "not_found") {
        return <NotFoundPage/>;
    }

    const collectionSearch = readCollectionSearch(location.state);
    const backState: ModelLinkState = {focusModel: slug};

    return (
        <div className="layout">
            <Header count={summariesQuery.data?.length ?? 0}/>

            <div className="content">
                <nav className="breadcrumb" aria-label="Breadcrumb">
                    <ol>
                        <li>
                            {/* Returns to the filters/search/sort the model was opened from. */}
                            <Link to={collectionPath(collectionSearch)} state={backState} className="breadcrumbLink">
                                <Home width={16} height={16}/>
                                <span>Collection</span>
                            </Link>
                        </li>
                        {modelQuery.data && (
                            <>
                                <li>
                                    <ChevronRight className="breadcrumbSeparator" width={14} height={14}/>
                                    {/* No brand page until Phase 22 — the collection filtered to the brand is the real equivalent. */}
                                    <Link to={collectionFilterPath("brand", modelQuery.data.brand.slug)} className="breadcrumbLink">
                                        {modelQuery.data.brand.name}
                                    </Link>
                                </li>
                                <li>
                                    <ChevronRight className="breadcrumbSeparator" width={14} height={14}/>
                                    <span aria-current="page" className="breadcrumbCurrent">{modelQuery.data.name}</span>
                                </li>
                            </>
                        )}
                    </ol>
                </nav>

                <main className="main">
                    {modelQuery.isPending ? (
                        <DetailsSkeleton/>
                    ) : modelQuery.isError ? (
                        <div className="contentError">
                            <p>{modelQuery.error.message}</p>
                            {modelQuery.error.retryable && (
                                <button type="button" className="retryButton" onClick={() => modelQuery.refetch()}>
                                    Try again
                                </button>
                            )}
                        </div>
                    ) : (
                        <ModelDetails model={modelQuery.data}/>
                    )}
                </main>
            </div>
        </div>
    );
}

function ModelDetails({model}: {model: Model}) {
    const racing = getRacingSpecs(model);
    const hasRacingBadges = model.isRacing && (model.carNumber !== null || !!model.driver);

    return (
        <>
            <article className="detailsTop" aria-labelledby="model-title">
                <ModelMedia model={model}/>

                <div className="detailsInfo">
                    <header className="detailsHeader">
                        <div className="detailsHeaderRow">
                            <span className="detailsBrandLogo">
                                <LogoOrText logoPath={model.brand.logoPath} name={model.brand.name} textClassName="detailsBrandText"/>
                            </span>
                            {/* Admin actions slot (Edit / Delete / …) — Phases 24/25. */}
                        </div>

                        <h1 id="model-title" className="detailsTitle">{model.name}</h1>

                        <p className="detailsMeta">
                            <span className="detailsMetaYear">{model.year}</span>
                            <span aria-hidden="true">·</span>
                            <span>{model.manufacturer.name}</span>
                            <span aria-hidden="true">·</span>
                            <span>{model.scale}</span>
                            <span className="detailsCategoryPill"><CategoryLabel category={model.category.name}/></span>
                        </p>

                        {hasRacingBadges && (
                            <p className="detailsRacing">
                                {model.carNumber !== null && <span className="detailsRacingNumber">#{model.carNumber}</span>}
                                {model.driver && (
                                    <span className="detailsRacingDriver">
                                        <img className="detailsRacingWheel" src="/wheel.svg" alt="" aria-hidden="true"/>
                                        <span>{model.driver.name}</span>
                                        {model.driver.countryCode && (
                                            <span aria-hidden="true">{countryCodeToFlagEmoji(model.driver.countryCode)}</span>
                                        )}
                                    </span>
                                )}
                            </p>
                        )}

                        <span className="detailsRule" aria-hidden="true"/>
                    </header>

                    <ul className="specTiles" aria-label="Key specifications">
                        <SpecTile label="Brand" to={collectionFilterPath("brand", model.brand.slug)} linkHint={`all ${model.brand.name} models`}>
                            <TileLogo logoPath={model.brand.logoPath}/>
                            <span>{model.brand.name}</span>
                        </SpecTile>
                        <SpecTile label="Manufacturer" to={collectionFilterPath("manufacturer", model.manufacturer.slug)} linkHint={`all ${model.manufacturer.name} models`}>
                            <TileLogo logoPath={model.manufacturer.logoPath}/>
                            <span>{model.manufacturer.name}</span>
                        </SpecTile>
                        <SpecTile label="Category" to={collectionFilterPath("category", model.category.slug)} linkHint={`all ${model.category.name} models`}>
                            <Car className="specTileIcon" width={18} height={18}/>
                            <CategoryLabel category={model.category.name}/>
                        </SpecTile>
                        <SpecTile label="Scale">
                            <Scale className="specTileIcon" width={18} height={18}/>
                            <span>{model.scale}</span>
                        </SpecTile>
                        <SpecTile label={model.colors.length > 1 ? "Colors" : "Color"}>
                            {model.liveryHex.length > 0 && <ColorCircle hex={model.liveryHex}/>}
                            <span>{formatColors(model) ?? "—"}</span>
                        </SpecTile>
                        <SpecTile label="Year">
                            <Calendar className="specTileIcon" width={18} height={18}/>
                            <span>{model.year}</span>
                        </SpecTile>
                    </ul>
                </div>
            </article>

            <DetailsTabs model={model} racing={racing}/>
        </>
    );
}

type SpecTileProps = {
    label: string;
    children: ReactNode;
    // Brand / manufacturer / category tiles open the collection filtered to that value.
    to?: string;
    linkHint?: string;
};

function SpecTile({label, to, linkHint, children}: SpecTileProps) {
    const body = (
        <>
            <span className="specTileLabel">{label}</span>
            <span className="specTileValue">{children}</span>
        </>
    );

    return (
        <li className="specTile">
            {to ? (
                <Link to={to} className="specTileInner specTileLink">
                    {body}
                    {linkHint && <span className="visuallyHidden"> — show {linkHint}</span>}
                    <ChevronRight className="specTileArrow" width={14} height={14}/>
                </Link>
            ) : (
                <div className="specTileInner">{body}</div>
            )}
        </li>
    );
}

// Decorative (the name is right next to it); a missing or broken logo simply isn't shown.
function TileLogo({logoPath}: {logoPath: string | null}) {
    const [broken, setBroken] = useState(false);
    const src = logoSrc(logoPath);
    if (!src || broken) return null;
    return <img className="specTileLogo" src={src} alt="" aria-hidden="true" onError={() => setBroken(true)}/>;
}

// The primary image, as large as the layout allows. The multi-image gallery, lightbox and
// fullscreen view are Phase 20 — every model has exactly one image today.
function ModelMedia({model}: {model: Model}) {
    const [broken, setBroken] = useState(false);
    const image = primaryImage(model.images);
    const src = image?.url ?? image?.thumbUrl ?? null;

    return (
        <figure className="detailsMedia">
            <div className="detailsMediaFrame">
                {src && !broken ? (
                    <img
                        src={src}
                        alt={`${model.name} (${model.year}), ${model.manufacturer.name} ${model.scale} model`}
                        width={image?.width ?? undefined}
                        height={image?.height ?? undefined}
                        decoding="async"
                        onError={() => setBroken(true)}
                    />
                ) : (
                    <div className="detailsMediaFallback">{src ? "Image unavailable" : "No photo yet"}</div>
                )}

                <div className="detailsMediaTopRow">
                    <div className="manufacturerBadge">
                        <LogoOrText logoPath={model.manufacturer.logoPath} name={model.manufacturer.name} textClassName="manufacturerBadgeText"/>
                    </div>
                    <div className="scaleBadge">{model.scale}</div>
                </div>
            </div>
        </figure>
    );
}

function primaryImage(images: ModelImage[]): ModelImage | null {
    return images.find((image) => image.isPrimary) ?? images[0] ?? null;
}

function DetailsTabs({model, racing}: {model: Model; racing: SpecRow[]}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const baseId = useId();
    const tabRefs = useRef(new Map<DetailTab, HTMLButtonElement>());

    const tabs = getAvailableTabs(model);
    const active = resolveTab(searchParams.get(TAB_PARAM), tabs);

    // `?tab=` keeps the open tab across refresh and in shared links. Replace, not push: switching
    // tabs isn't navigation worth a Back step. The default tab writes no param at all.
    const selectTab = (tab: DetailTab) => {
        const next = new URLSearchParams(searchParams);
        if (tab === tabs[0]) next.delete(TAB_PARAM); else next.set(TAB_PARAM, tab);
        setSearchParams(next, {replace: true, state: location.state, preventScrollReset: true});
    };

    // WAI-ARIA tabs pattern: arrow keys / Home / End move between tabs and select them.
    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const index = tabs.indexOf(active);
        const target =
            event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length]
            : event.key === "ArrowLeft" ? tabs[(index - 1 + tabs.length) % tabs.length]
            : event.key === "Home" ? tabs[0]
            : event.key === "End" ? tabs[tabs.length - 1]
            : undefined;
        if (!target) return;
        event.preventDefault();
        selectTab(target);
        tabRefs.current.get(target)?.focus();
    };

    const panel = <TabPanelContent tab={active} model={model} racing={racing}/>;

    // One section only (a model with no extra data): a heading reads better than a lone tab.
    if (tabs.length === 1) {
        return (
            <section className="detailsSections" aria-labelledby={`${baseId}-heading`}>
                <h2 id={`${baseId}-heading`} className="detailsSectionsHeading">{tabLabel(active, model)}</h2>
                <div className="detailsPanel">{panel}</div>
            </section>
        );
    }

    return (
        <section className="detailsSections">
            <div role="tablist" aria-label="Model information" className="detailsTabList">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        ref={(node) => {
                            if (node) tabRefs.current.set(tab, node); else tabRefs.current.delete(tab);
                        }}
                        type="button"
                        role="tab"
                        id={`${baseId}-tab-${tab}`}
                        aria-selected={tab === active}
                        aria-controls={`${baseId}-panel`}
                        tabIndex={tab === active ? 0 : -1}
                        className={`detailsTab${tab === active ? " detailsTabActive" : ""}`}
                        onClick={() => selectTab(tab)}
                        onKeyDown={onKeyDown}
                    >
                        {tabLabel(tab, model)}
                    </button>
                ))}
            </div>

            <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`} tabIndex={0} className="detailsPanel">
                {panel}
            </div>
        </section>
    );
}

function TabPanelContent({tab, model, racing}: {tab: DetailTab; model: Model; racing: SpecRow[]}) {
    const facts = getCollectionFacts(model);

    if (tab === "overview") {
        return (
            <div className={`overviewGrid${facts.length > 0 ? " overviewGridWithAside" : ""}`}>
                <div className="overviewMain">
                    {model.description?.trim() && (
                        <section className="detailsBlock">
                            <h3 className="detailsBlockTitle">About this model</h3>
                            {model.description.trim().split(/\n\s*\n/).map((paragraph, i) => (
                                <p key={i} className="detailsProse">{paragraph}</p>
                            ))}
                        </section>
                    )}

                    {(model.keyFeatures.length > 0 || model.tags.length > 0) && (
                        <div className="featuresRow">
                            {model.keyFeatures.length > 0 && (
                                <section className="detailsBlock">
                                    <h3 className="detailsBlockTitle">Key Features</h3>
                                    <ul className="featureList">
                                        {model.keyFeatures.map((feature) => (
                                            <li key={feature}>
                                                <Check className="featureCheck" width={14} height={14}/>
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                            {model.tags.length > 0 && (
                                <section className="detailsBlock">
                                    <h3 className="detailsBlockTitle">Tags</h3>
                                    <ul className="tagList">
                                        {model.tags.map((tag) => <li key={tag.slug} className="tagPill">{tag.name}</li>)}
                                    </ul>
                                </section>
                            )}
                        </div>
                    )}
                </div>

                {facts.length > 0 && <CollectionCard facts={facts}/>}
            </div>
        );
    }

    if (tab === "gallery") {
        // Plain thumbnails for now; the real gallery (viewer, lightbox) is Phase 20.
        return (
            <ul className="galleryGrid">
                {model.images.map((image, i) => (
                    <li key={image.id} className="galleryItem">
                        {(image.thumbUrl ?? image.url) && (
                            <img src={image.thumbUrl ?? image.url ?? undefined} alt={`${model.name}, photo ${i + 1} of ${model.images.length}`} loading="lazy" decoding="async"/>
                        )}
                    </li>
                ))}
            </ul>
        );
    }

    if (tab === "collection") {
        return <CollectionCard facts={facts}/>;
    }

    const modelRows: SpecRow[] = [
        {label: "Brand", value: model.brand.name},
        {label: "Model", value: model.name},
        {label: "Year", value: String(model.year)},
        {label: "Manufacturer", value: model.manufacturer.name},
        {label: "Scale", value: model.scale},
        {label: "Category", value: model.category.name},
    ];
    const colors = formatColors(model);
    if (colors) modelRows.push({label: model.colors.length > 1 ? "Colors" : "Color", value: colors});

    // Group titles only when there is more than one group — a lone "Model" under
    // "Specifications" just repeats itself.
    return (
        <div className="specGroups">
            <SpecList title={racing.length > 0 ? "Model" : null} rows={modelRows}/>
            {racing.length > 0 && <SpecList title="Racing" rows={racing}/>}
        </div>
    );
}

function SpecList({title, rows}: {title: string | null; rows: SpecRow[]}) {
    return (
        <section className="detailsBlock" aria-label={title ?? undefined}>
            {title && <h3 className="detailsBlockTitle">{title}</h3>}
            <dl className="specList">
                {rows.map((row) => (
                    <div key={row.label} className="specListRow">
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

function CollectionCard({facts}: {facts: SpecRow[]}) {
    return (
        <aside className="collectionCard" aria-label="My Collection">
            <h3 className="detailsBlockTitle">My Collection</h3>
            <dl className="specList">
                {facts.map((row) => (
                    <div key={row.label} className="specListRow">
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                    </div>
                ))}
            </dl>
        </aside>
    );
}

// Same box model as the loaded page, so data arriving doesn't reflow it.
function DetailsSkeleton() {
    return (
        <div className="detailsTop detailsSkeleton" aria-busy="true" aria-label="Loading model">
            <div className="detailsMedia"><div className="detailsMediaFrame thumbSkeleton"/></div>
            <div className="detailsInfo">
                <span className="skeletonBar skeletonBarTitle"/>
                <span className="skeletonBar skeletonBarMeta"/>
                <ul className="specTiles" aria-hidden="true">
                    {["a", "b", "c", "d", "e", "f"].map((key) => <li key={key} className="specTile specTileSkeleton"/>)}
                </ul>
            </div>
        </div>
    );
}
