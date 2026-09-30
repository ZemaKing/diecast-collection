import {useState} from "react";

import {ColorCircle} from "../ColorCircle/ColorCircle";
import {CategoryLabel} from "../CategoryLabel/CategoryLabel";
import {LogoOrText} from "./LogoOrText.tsx";

import type {ModelSummary} from "../../services/types.ts";
import {countryCodeToFlagEmoji} from "../../utils/model-display.ts";

import "./ModelCard.css";

type ModelCardProps = {
    model: ModelSummary;
    onClick: () => void;
};

export function ModelCard({model, onClick}: ModelCardProps) {
    const [imageBroken, setImageBroken] = useState(false);

    const imageUrl = model.image?.thumbUrl ?? model.image?.url ?? null;
    const hasCarNumber = model.carNumber !== null;
    const hasDriver = !!model.driver;

    return (
        <button type="button" className="card" id={model.slug} onClick={onClick}>
            <div className="thumb">
                {imageUrl && !imageBroken ? (
                    <img
                        src={imageUrl}
                        alt={`${model.name} (${model.year})`}
                        loading="lazy"
                        decoding="async"
                        onError={() => setImageBroken(true)}
                    />
                ) : (
                    <div className="thumbFallback" aria-hidden="true">{model.name}</div>
                )}

                <div className="thumbTopRow">
                    <div className="manufacturerBadge">
                        <LogoOrText logoPath={model.manufacturer.logoPath} name={model.manufacturer.name} textClassName="manufacturerBadgeText"/>
                    </div>

                    <div className="scaleBadge">{model.scale}</div>
                </div>

                {(hasCarNumber || hasDriver) && (
                    <div className="carDetails">
                        {hasCarNumber && <div className="carNumberBadge">#{model.carNumber}</div>}

                        {model.driver && (
                            <div className="carDriverBadge">
                                <img className="carDriverLogo" src="/wheel.svg" alt="" aria-hidden="true"/>
                                <span>{model.driver.name}</span>
                                {model.driver.countryCode && (
                                    <span className="countryFlag">{countryCodeToFlagEmoji(model.driver.countryCode)}</span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="cardTitle">
                <span>{model.name}</span>
                {model.liveryHex.length > 0 && <ColorCircle hex={model.liveryHex}/>}
            </div>

            <div className="cardMeta">
                <LogoOrText logoPath={model.brand.logoPath} name={model.brand.name} imgClassName="brandLogo" textClassName="cardMetaText"/>
                <span aria-hidden="true">•</span>
                <span>{model.year}</span>
                <span aria-hidden="true">•</span>
                <span>{model.manufacturer.name}</span>
                <span aria-hidden="true">•</span>
                <CategoryLabel category={model.category.name}/>
            </div>
        </button>
    );
}
