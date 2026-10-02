import {useState} from "react";
import {ImagePlaceholder, Skeleton} from "../States/States.tsx";

type GalleryImageProps = {
    src: string | null;
    alt: string;
    width?: number | null;
    height?: number | null;
    className?: string;
};

// One photo with its loading shimmer and missing-image fallback (ROADMAP Phase 20). Render it with
// `key={src}` so switching photos starts a fresh load state instead of flashing the old one.
export function GalleryImage({src, alt, width, height, className = "galleryImage"}: GalleryImageProps) {
    const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

    if (!src || status === "error") {
        return (
            <div className="galleryFallback" role="img" aria-label={`${alt} — ${src ? "image unavailable" : "no photo yet"}`}>
                <ImagePlaceholder reason={src ? "broken" : "missing"}/>
            </div>
        );
    }

    return (
        <>
            {status === "loading" && <Skeleton as="div" className="galleryImageSkeleton"/>}
            <img
                className={`${className}${status === "loaded" ? " galleryImageLoaded" : ""}`}
                src={src}
                alt={alt}
                width={width ?? undefined}
                height={height ?? undefined}
                decoding="async"
                draggable={false}
                onLoad={() => setStatus("loaded")}
                onError={() => setStatus("error")}
            />
        </>
    );
}
