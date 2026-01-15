import {useEffect, useState} from "react";

import type {DiecastModel} from "../../types.ts";

import "./DetailsModal.css";

type DetailsModalProps = {
    model: DiecastModel | null;
    isOpen: boolean;
    onClose: () => void;
};

const getValue = (v: unknown, fallback: string = "—") => v === null || v === undefined || v === "" ? fallback : String(v);

export function DetailsModal({model, isOpen, onClose}: DetailsModalProps) {
    const [isImageOpen, setIsImageOpen] = useState(false);

    const preSortedColors = (colors: string[]) => {
        if (colors.length <= 1) {
            return colors;
        }

        return [colors[colors.length - 1], ...colors.slice(0, -1)];
    }

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (isImageOpen) {
                    setIsImageOpen(false);
                } else {
                    onClose();
                }
            }
        };

        document.addEventListener("keydown", onKeyDown);

        const scrollY = window.scrollY;
        document.body.classList.add("zkNoScroll");
        document.body.style.top = `-${scrollY}px`;

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            // document.body.style.overflow = prevOverflow;

            document.body.classList.remove("zkNoScroll");
            document.body.style.top = "";
            window.scrollTo(0, scrollY);
        };
    }, [isOpen, isImageOpen, onClose]);

    if (!isOpen || !model) return null;

    return (
        <>
            <div className="zkModalOverlay" onMouseDown={onClose}>
                <div
                    className="zkModal"
                    onMouseDown={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Details for ${model.name}`}
                >
                    <button className="zkModalClose" onClick={onClose} aria-label="Close">✕</button>

                    <div className="zkModalTop">
                        <button className="zkImageExpand" onClick={() => setIsImageOpen(true)}>⛶</button>

                        <img className="zkModalImage" src={model.imageUrl} alt={model.name}/>
                    </div>


                    <div className="zkModalBottom">
                        <h2 className="zkModalTitle">{model.name}</h2>

                        <div className="zkModalTwoCols">
                            <div className="zkModalCol">
                                <div className="zkModalRow">
                                    <span className="zkModalLabel">Brand</span>
                                    <span className="zkModalValue">{getValue(model.brand)}</span>
                                </div>
                                <div className="zkModalRow">
                                    <span className="zkModalLabel">Manufacturer</span>
                                    <span className="zkModalValue">{getValue(model.manufacturer)}</span>
                                </div>
                                <div className="zkModalRow">
                                    <span className="zkModalLabel">Category</span>
                                    <span className="zkModalValue">{getValue(model.category)}</span>
                                </div>
                                <div className="zkModalRow">
                                    <span className="zkModalLabel">Year</span>
                                    <span className="zkModalValue">{getValue(model.year)}</span>
                                </div>
                            </div>

                            <div className="zkModalCol">
                                <div className="zkModalRow">
                                    <span className="zkModalLabel">Colors</span>
                                    <span className="zkModalValue">
                                        {preSortedColors(model.hex ?? []).map(color => (
                                            <span key={color} className="colorPill" style={{background: color}}></span>
                                        ))}
                                    </span>
                                </div>
                                <div className="zkModalRow">
                                    <span className="zkModalLabel">Scale</span>
                                    <span className="zkModalValue">{getValue(model.scale, "1:43")}</span>
                                </div>
                                <div className="zkModalRow">
                                    <span className="zkModalLabel">Driver</span>
                                    <span className="zkModalValue">{getValue(model.carDriver)}</span>
                                </div>
                                <div className="zkModalRow">
                                    <span className="zkModalLabel">Car Number</span>
                                    <span className="zkModalValue">{getValue(model.carNumber)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isImageOpen && (
                <div className="zkImageOverlay" onMouseDown={() => setIsImageOpen(false)}>
                    <div className="zkImageContainer" onMouseDown={(e) => e.stopPropagation()}>
                        <button
                            className="zkImageClose"
                            onClick={() => setIsImageOpen(false)}
                            aria-label="Close image preview"
                        >✕</button>

                        <img className="zkImageFullscreen" src={model.imageUrl} alt={model.name}
                             onMouseDown={(e) => e.stopPropagation()}/>
                    </div>
                </div>
            )}
        </>
    );
}
