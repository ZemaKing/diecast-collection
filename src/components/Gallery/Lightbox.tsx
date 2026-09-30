import {useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent} from "react";

import {GalleryImage} from "./GalleryImage.tsx";
import {GalleryThumbs} from "./ModelGallery.tsx";

import {useModalDialog} from "../../hooks/useModalDialog.ts";
import {ChevronLeft} from "../../icons/ChevronLeft.tsx";
import {ChevronRight} from "../../icons/ChevronRight.tsx";
import {Close} from "../../icons/Close.tsx";
import type {ModelImage} from "../../services/types.ts";
import {counterLabel, fullSrc, imageAlt, neighborIndexes, swipeDirection, wrapIndex} from "../../utils/gallery.ts";

import "./Gallery.css";

type LightboxProps = {
    images: ModelImage[];
    index: number;
    onIndexChange: (index: number) => void;
    onClose: () => void;
    title: string;
    modelLabel: string;
};

// Fullscreen photo viewer (ROADMAP Phase 20). Mount it to open it, unmount to close — it's a native
// modal <dialog> (useModalDialog), so Escape, the focus trap and returning focus to the button
// that opened it are handled. ←/→ step through the photos, a horizontal swipe does the same on
// touch (plain pointer events), and the photos either side are preloaded so stepping is instant.
export function Lightbox({images, index, onIndexChange, onClose, title, modelLabel}: LightboxProps) {
    const {dialogRef, close} = useModalDialog(onClose);
    const pointerStartRef = useRef<{id: number; x: number; y: number} | null>(null);
    const swipedRef = useRef(false);

    const count = images.length;
    const active = wrapIndex(index, count);
    const current = count > 0 ? images[active] : null;
    const src = current ? fullSrc(current) : null;
    const go = (delta: number) => onIndexChange(wrapIndex(index + delta, count));

    useEffect(() => {
        for (const neighbor of neighborIndexes(active, count)) {
            const url = fullSrc(images[neighbor]);
            if (url) new Image().src = url;
        }
    }, [active, count, images]);

    const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
        if (count < 2) return;
        if (event.key === "ArrowRight") go(1);
        else if (event.key === "ArrowLeft") go(-1);
        else return;
        event.preventDefault();
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (!event.isPrimary) return;
        pointerStartRef.current = {id: event.pointerId, x: event.clientX, y: event.clientY};
        swipedRef.current = false;
    };

    const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
        const start = pointerStartRef.current;
        pointerStartRef.current = null;
        if (!start || start.id !== event.pointerId || count < 2) return;

        const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
        if (!direction) return;
        swipedRef.current = true;
        go(direction === "next" ? 1 : -1);
    };

    // A click on the empty stage around the photo closes, like clicking a backdrop — unless it
    // was the end of a swipe.
    const onStageClick = (event: MouseEvent<HTMLDivElement>) => {
        if (swipedRef.current) {
            swipedRef.current = false;
            return;
        }
        if (event.target === event.currentTarget) close();
    };

    return (
        <dialog ref={dialogRef} className="lightbox" aria-label={`${title} — photos`} onKeyDown={onKeyDown}>
            <div className="lightboxInner">
                <div className="lightboxBar">
                    <p className="lightboxTitle">{title}</p>
                    {count > 1 && <span className="lightboxCounter" aria-hidden="true">{counterLabel(active, count)}</span>}
                    {count > 1 && <span className="visuallyHidden" aria-live="polite">Photo {active + 1} of {count}</span>}
                    <button type="button" className="lightboxButton lightboxClose" aria-label="Close photo viewer" onClick={close} autoFocus>
                        <Close/>
                    </button>
                </div>

                <div
                    className="lightboxStage"
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => { pointerStartRef.current = null; }}
                    onClick={onStageClick}
                >
                    <GalleryImage
                        key={src ?? "none"}
                        src={src}
                        alt={current ? imageAlt(current, modelLabel, active, count) : modelLabel}
                        width={current?.width}
                        height={current?.height}
                        className="lightboxImage"
                    />

                    {count > 1 && (
                        <>
                            <button type="button" className="lightboxButton lightboxNav lightboxNavPrev" aria-label="Previous photo" onClick={() => go(-1)}>
                                <ChevronLeft width={28} height={28}/>
                            </button>
                            <button type="button" className="lightboxButton lightboxNav lightboxNavNext" aria-label="Next photo" onClick={() => go(1)}>
                                <ChevronRight width={28} height={28}/>
                            </button>
                        </>
                    )}
                </div>

                {count > 1 && <GalleryThumbs images={images} index={active} onSelect={onIndexChange} className="lightboxThumbs"/>}
            </div>
        </dialog>
    );
}
