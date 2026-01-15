import {useEffect} from "react";
import "./DetailsModal.css";
import type {DiecastModel} from "../../types.ts";

export function DetailsModal({model, isOpen, onClose}: { model: DiecastModel; isOpen: boolean; onClose: () => void }) {
    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        document.addEventListener("keydown", onKeyDown);
        // prevent background scroll
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen, onClose]);

    if (!isOpen || !model) return null;

    return (
        <div className="zkModalOverlay" onMouseDown={onClose}>
            <div
                className="zkModal"
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`Details for ${model.name}`}
            >
                <button className="zkModalClose" onClick={onClose} aria-label="Close">
                    ✕
                </button>

                <div className="zkModalBody">
                    <div className="zkModalImageWrap">
                        <img className="zkModalImage" src={model.imageUrl} alt={model.name}/>
                    </div>

                    <div className="zkModalInfo">
                        <h2 className="zkModalTitle">{model.name}</h2>

                        <div className="zkModalGrid">
                            <div className="zkModalRow">
                                <span className="zkModalLabel">Year</span>
                                <span className="zkModalValue">{model.year ?? "—"}</span>
                            </div>

                            <div className="zkModalRow">
                                <span className="zkModalLabel">Brand</span>
                                <span className="zkModalValue">{model.brand ?? "—"}</span>
                            </div>

                            <div className="zkModalRow">
                                <span className="zkModalLabel">Manufacturer</span>
                                <span className="zkModalValue">{model.manufacturer ?? "—"}</span>
                            </div>

                            <div className="zkModalRow">
                                <span className="zkModalLabel">Category</span>
                                <span className="zkModalValue">{model.category ?? "—"}</span>
                            </div>

                            <div className="zkModalRow">
                                <span className="zkModalLabel">Color</span>
                                <span className="zkModalValue">{model.color ?? "—"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
