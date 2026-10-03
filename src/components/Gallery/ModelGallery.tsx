import type {KeyboardEvent, ReactNode} from "react";

import {GalleryImage} from "./GalleryImage.tsx";

import {ChevronLeft} from "../../icons/ChevronLeft.tsx";
import {ChevronRight} from "../../icons/ChevronRight.tsx";
import {Expand} from "../../icons/Expand.tsx";
import type {ModelImage} from "../../services/types.ts";
import {counterLabel, fullSrc, imageAlt, thumbSrc, wrapIndex} from "../../utils/gallery.ts";

import "../ModelCard/ModelCard.css";
import "./Gallery.css";

type ModelGalleryProps = {
    // Already filtered to photos that can render (displayableImages()).
    images: ModelImage[];
    index: number;
    onIndexChange: (index: number) => void;
    onOpenLightbox: () => void;
    // "Chevrolet Corvette Stingray (2020), IXO 1:43 model" — the base of every photo's alt text.
    modelLabel: string;
    // Overlaid on the photo's top edge (manufacturer logo, scale).
    badges?: ReactNode;
    // The thumbnail strip — the details page has room for it, Quick View doesn't (per mockup).
    showThumbnails?: boolean;
    variant?: "page" | "compact";
};

// The model's photos (ROADMAP Phase 20): main photo, prev/next, "1 / n", fullscreen, thumbnails.
// Controlled — the page owns the index, so closing the lightbox leaves the gallery on the photo
// the reader ended on. Every model has a single photo today: then there are no arrows, counter or
// strip, just the photo and the fullscreen button.
export function ModelGallery({
    images,
    index,
    onIndexChange,
    onOpenLightbox,
    modelLabel,
    badges,
    showThumbnails = true,
    variant = "page",
}: ModelGalleryProps) {
    const count = images.length;
    const current = count > 0 ? images[wrapIndex(index, count)] : null;
    const src = current ? fullSrc(current) : null;
    const go = (delta: number) => onIndexChange(wrapIndex(index + delta, count));

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (count < 2) return;
        if (event.key === "ArrowRight") go(1);
        else if (event.key === "ArrowLeft") go(-1);
        else return;
        event.preventDefault();
    };

    return (
        <div className={`gallery gallery-${variant}`} onKeyDown={onKeyDown}>
            <div className="galleryFrame">
                {/* Clicking the photo is a mouse shortcut to the fullscreen button below, which is the
                    keyboard/screen-reader route — so this stays a plain, non-focusable element. */}
                <div className={`galleryStage${src ? " galleryStageZoomable" : ""}`} onClick={src ? onOpenLightbox : undefined}>
                    <GalleryImage
                        key={src ?? "none"}
                        src={src}
                        alt={current ? imageAlt(current, modelLabel, wrapIndex(index, count), count) : modelLabel}
                        width={current?.width}
                        height={current?.height}
                        priority
                    />
                </div>

                {badges && <div className="galleryBadges">{badges}</div>}

                {count > 1 && (
                    <>
                        <button type="button" className="galleryNav galleryNavPrev" aria-label="Previous photo" onClick={() => go(-1)}>
                            <ChevronLeft/>
                        </button>
                        <button type="button" className="galleryNav galleryNavNext" aria-label="Next photo" onClick={() => go(1)}>
                            <ChevronRight/>
                        </button>
                        <span className="galleryCounter" aria-hidden="true">{counterLabel(index, count)}</span>
                        <span className="visuallyHidden" aria-live="polite">Photo {wrapIndex(index, count) + 1} of {count}</span>
                    </>
                )}

                {src && (
                    <button type="button" className="galleryFullscreen" aria-label="View photo fullscreen" onClick={onOpenLightbox}>
                        <Expand width={18} height={18}/>
                    </button>
                )}
            </div>

            {showThumbnails && count > 1 && (
                <GalleryThumbs images={images} index={index} onSelect={onIndexChange} className="galleryThumbs"/>
            )}
        </div>
    );
}

type GalleryThumbsProps = {
    images: ModelImage[];
    index: number;
    onSelect: (index: number) => void;
    className: string;
};

export function GalleryThumbs({images, index, onSelect, className}: GalleryThumbsProps) {
    const active = wrapIndex(index, images.length);

    return (
        <ul className={className}>
            {images.map((image, i) => (
                <li key={image.id}>
                    <button
                        type="button"
                        className={`galleryThumb${i === active ? " galleryThumbActive" : ""}`}
                        aria-label={image.alt ? `Show photo ${i + 1} of ${images.length}: ${image.alt}` : `Show photo ${i + 1} of ${images.length}`}
                        aria-current={i === active ? "true" : undefined}
                        onClick={() => onSelect(i)}
                    >
                        {/* The button's label names it; the thumbnail itself is decorative. */}
                        <img src={thumbSrc(image) ?? undefined} alt="" loading="lazy" decoding="async" draggable={false}/>
                    </button>
                </li>
            ))}
        </ul>
    );
}
