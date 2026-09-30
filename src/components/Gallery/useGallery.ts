import {useMemo, useState} from "react";

import type {ModelImage} from "../../services/types.ts";
import {displayableImages, primaryIndex} from "../../utils/gallery.ts";

// Gallery + lightbox state shared by the details page and Quick View: which photo is showing
// (starts on the primary one) and whether the lightbox is open. One index for both, so the
// gallery ends up on whatever photo the reader closed the lightbox on.
export function useGallery(images: ModelImage[]) {
    const photos = useMemo(() => displayableImages(images), [images]);
    const [index, setIndex] = useState(() => primaryIndex(photos));
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const openLightbox = (at?: number) => {
        if (at !== undefined) setIndex(at);
        setLightboxOpen(true);
    };

    return {photos, index, setIndex, lightboxOpen, openLightbox, closeLightbox: () => setLightboxOpen(false)};
}

// "Chevrolet Corvette Stingray (2020), IXO 1:43 model" — the base of every photo's alt text.
export function modelPhotoLabel(model: {name: string; year: number; scale: string; manufacturer: {name: string}}): string {
    return `${model.name} (${model.year}), ${model.manufacturer.name} ${model.scale} model`;
}
