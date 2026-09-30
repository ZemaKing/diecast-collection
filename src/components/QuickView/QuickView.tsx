import {useId, useMemo} from "react";
import {Link} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";

import {CategoryLabel} from "../CategoryLabel/CategoryLabel";
import {ColorCircle} from "../ColorCircle/ColorCircle";
import {Lightbox} from "../Gallery/Lightbox.tsx";
import {ModelGallery} from "../Gallery/ModelGallery.tsx";
import {modelPhotoLabel, useGallery} from "../Gallery/useGallery.ts";
import {LogoOrText} from "../ModelCard/LogoOrText.tsx";
import {SpecTiles} from "../SpecTiles/SpecTiles.tsx";

import {useModalDialog} from "../../hooks/useModalDialog.ts";
import {ArrowRight} from "../../icons/ArrowRight.tsx";
import {Close} from "../../icons/Close.tsx";
import type {AppError} from "../../lib/errors.ts";
import {getModelBySlug} from "../../services/models.ts";
import type {Model, ModelImage, ModelSummary} from "../../services/types.ts";
import {modelPath, type ModelLinkState} from "../../utils/model-link.ts";

import "./QuickView.css";

type QuickViewProps = {
    model: ModelSummary;
    // Carried by "View Details", so the details page's breadcrumb returns to the same filters.
    linkState?: ModelLinkState;
    onClose: () => void;
};

// Quick View (ROADMAP Phase 20 — "Quick View Modal (Desktop)" in the details mockup): a look at a
// model without leaving the collection. Mount to open, unmount to close (native <dialog>). It
// renders straight away from the summary the card already has; the full model (every photo) loads
// behind it into the same `["model", slug]` cache the details page reads, so "View Details" is
// instant. Not rendered: the mockup's "Add to Collection" (open decision 7, as on the details page).
export function QuickView({model, linkState, onClose}: QuickViewProps) {
    const titleId = useId();
    const {dialogRef, close, backdropProps} = useModalDialog(onClose);

    const fullQuery = useQuery<Model, AppError>({
        queryKey: ["model", model.slug],
        queryFn: () => getModelBySlug(model.slug),
        retry: (failureCount, error) => error.kind !== "not_found" && failureCount < 1,
    });

    // Until the full model arrives (or if it fails), the summary's primary photo is the gallery.
    const summaryImages = useMemo((): ModelImage[] => model.image
        ? [{id: `${model.slug}-primary`, position: 0, isPrimary: true, alt: null, ...model.image}]
        : [], [model.slug, model.image]);
    const images = fullQuery.data?.images ?? summaryImages;

    return (
        <dialog ref={dialogRef} className="quickView" aria-labelledby={titleId} {...backdropProps}>
            <div className="quickViewInner">
                <button type="button" className="quickViewClose" aria-label="Close quick view" onClick={close}>
                    <Close width={18} height={18}/>
                </button>

                {/* Keyed so the gallery restarts on the primary photo when the full set lands. */}
                <QuickViewGallery key={fullQuery.data ? "full" : "summary"} model={model} images={images}/>

                <div className="quickViewBody">
                    <h2 id={titleId} className="quickViewTitle">{model.name}</h2>

                    <div className="quickViewMeta">
                        <span className="quickViewYear">{model.year}</span>
                        <span aria-hidden="true">·</span>
                        <span>{model.manufacturer.name}</span>
                        <span className="quickViewCategory"><CategoryLabel category={model.category.name}/></span>
                        {model.liveryHex.length > 0 && <ColorCircle hex={model.liveryHex}/>}
                    </div>

                    <SpecTiles model={model}/>

                    <Link to={modelPath(model.slug)} state={linkState} className="quickViewDetailsLink">
                        <span>View Details</span>
                        <ArrowRight width={18} height={18}/>
                    </Link>
                </div>
            </div>
        </dialog>
    );
}

function QuickViewGallery({model, images}: {model: ModelSummary; images: ModelImage[]}) {
    const gallery = useGallery(images);
    const photoLabel = modelPhotoLabel(model);

    return (
        <>
            <ModelGallery
                images={gallery.photos}
                index={gallery.index}
                onIndexChange={gallery.setIndex}
                onOpenLightbox={() => gallery.openLightbox()}
                modelLabel={photoLabel}
                showThumbnails={false}
                variant="compact"
                badges={(
                    <>
                        <div className="manufacturerBadge">
                            <LogoOrText logoPath={model.manufacturer.logoPath} name={model.manufacturer.name} textClassName="manufacturerBadgeText"/>
                        </div>
                        <div className="scaleBadge">{model.scale}</div>
                    </>
                )}
            />

            {gallery.lightboxOpen && (
                <Lightbox
                    images={gallery.photos}
                    index={gallery.index}
                    onIndexChange={gallery.setIndex}
                    onClose={gallery.closeLightbox}
                    title={model.name}
                    modelLabel={photoLabel}
                />
            )}
        </>
    );
}
