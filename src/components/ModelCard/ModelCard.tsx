import { ColorCircle } from "../ColorCircle/ColorCircle";
import { CategoryLabel } from "../CategoryLabel/CategoryLabel";

import type { DiecastModel } from "../../types";

import "./ModelCard.css";

type ModelCardProps = {
    model: DiecastModel;
    onClick: () => void;
};

export function ModelCard({ model, onClick }: ModelCardProps) {
    return (
        <div className="card">
            <div className="thumb">
                <img
                    src={model.thumbnail}
                    alt={`${model.name} (${model.year})`}
                    onClick={onClick}
                    loading="lazy"
                    decoding="async"
                />

                {(model.carNumber !== undefined || !!model.carDriver) && (
                    <div className="carDetails">
                        {model.carNumber !== undefined && (
                            <div className="carNumber">
                                <div className="carNumberWrapper">№ {model.carNumber}</div>
                            </div>
                        )}

                        {model.carDriver && (
                            <div className="carDriver">
                                <img className="carDriverLogo" src="/wheel.svg" alt="wheel" />
                                {model.carDriver}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="cardTitle">
                {model.name}
                {model.hex && <ColorCircle hex={model.hex} />}
            </div>

            <div className="cardMeta">
                <img src={`/brands/${model.brand}.svg`} alt="Model Brand" className="brandLogo"/>
                <span>•</span>
                <span>{model.year}</span>
                <span>•</span>
                <span>{model.manufacturer}</span>
                <span>•</span>
                <CategoryLabel category={model.category} />
            </div>
        </div>
    );
}
