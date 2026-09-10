import { ColorCircle } from "../ColorCircle/ColorCircle";
import { CategoryLabel } from "../CategoryLabel/CategoryLabel";

import type { DiecastModel } from "../../types";

import "./ModelCard.css";

type ModelCardProps = {
    model: DiecastModel;
    onClick: () => void;
};

const countryCodeToFlagEmoji = (countryCode: string) =>
    countryCode
        .toUpperCase()
        .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

export function ModelCard({ model, onClick }: ModelCardProps) {
    return (
        <div className="card" id={model.id}>
            <div className="thumb">
                <img
                    src={model.thumbnail}
                    alt={`${model.name} (${model.year})`}
                    onClick={onClick}
                    loading="lazy"
                    decoding="async"
                />

                <div className="thumbTopRow">
                    <div className="manufacturerBadge">
                        <img src={`/manufacturers/${model.manufacturer}.svg`} alt={model.manufacturer} />
                    </div>

                    <div className="scaleBadge">{model.scale ?? "1:43"}</div>
                </div>

                {(model.carNumber !== undefined || !!model.carDriver) && (
                    <div className="carDetails">
                        {model.carNumber !== undefined && (
                            <div className="carNumberBadge">#{model.carNumber}</div>
                        )}

                        {model.carDriver && (
                            <div className="carDriverBadge">
                                <img className="carDriverLogo" src="/wheel.svg" alt="driver" />
                                <span>{model.carDriver}</span>
                                {model.driverCountry && (
                                    <span className="countryFlag">{countryCodeToFlagEmoji(model.driverCountry)}</span>
                                )}
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
