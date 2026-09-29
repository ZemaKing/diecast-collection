import {useState} from "react";

import {ColorCircle} from "../ColorCircle/ColorCircle";
import {CategoryLabel} from "../CategoryLabel/CategoryLabel";

import type {ModelSummary} from "../../services/types.ts";

import "./ModelCard.css";

type ModelCardProps = {
    model: ModelSummary;
    onClick: () => void;
};

const countryCodeToFlagEmoji = (countryCode: string) =>
    countryCode
        .toUpperCase()
        .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

// `logo_path` values (from the importer) are exact filenames on disk, e.g. "/brands/Aston
// Martin.svg" — encodeURI so the space (or any other special character) round-trips in <img src>.
function logoSrc(logoPath: string | null): string | null {
    return logoPath ? encodeURI(logoPath) : null;
}

export function ModelCard({model, onClick}: ModelCardProps) {
    const [imageBroken, setImageBroken] = useState(false);
    const [manufacturerLogoBroken, setManufacturerLogoBroken] = useState(false);
    const [brandLogoBroken, setBrandLogoBroken] = useState(false);

    const imageUrl = model.image?.thumbUrl ?? model.image?.url ?? null;
    const manufacturerLogo = logoSrc(model.manufacturer.logoPath);
    const brandLogo = logoSrc(model.brand.logoPath);
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
                    {manufacturerLogo && !manufacturerLogoBroken ? (
                        <div className="manufacturerBadge">
                            <img src={manufacturerLogo} alt={model.manufacturer.name} onError={() => setManufacturerLogoBroken(true)}/>
                        </div>
                    ) : (
                        <div className="manufacturerBadge manufacturerBadgeText">{model.manufacturer.name}</div>
                    )}

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
                {brandLogo && !brandLogoBroken ? (
                    <img src={brandLogo} alt={model.brand.name} className="brandLogo" onError={() => setBrandLogoBroken(true)}/>
                ) : (
                    <span className="cardMetaText">{model.brand.name}</span>
                )}
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
