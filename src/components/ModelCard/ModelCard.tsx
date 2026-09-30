import {useState} from "react";
import {Link} from "react-router-dom";

import {ColorCircle} from "../ColorCircle/ColorCircle";
import {CategoryLabel} from "../CategoryLabel/CategoryLabel";
import {LogoOrText} from "./LogoOrText.tsx";

import {Eye} from "../../icons/Eye.tsx";
import type {ModelSummary} from "../../services/types.ts";
import {countryCodeToFlagEmoji} from "../../utils/model-display.ts";
import {modelPath, type ModelLinkState} from "../../utils/model-link.ts";

import "./ModelCard.css";

type ModelCardProps = {
    model: ModelSummary;
    linkState?: ModelLinkState;
    // Opens Quick View (ROADMAP Phase 20). Omitted → no trigger.
    onQuickView?: (model: ModelSummary) => void;
};

// The whole card is one link to the model's details page (ROADMAP Phase 19; a <button> that
// opened a modal before). `id={slug}` lets the collection bring it back into view on return.
// The Quick View button can't live inside the link (interactive content can't nest), so both sit
// in a shell and the button is laid over the photo; `data-slug` lets the collection's view-mode
// scroll anchoring find the card through the shell.
export function ModelCard({model, linkState, onQuickView}: ModelCardProps) {
    const [imageBroken, setImageBroken] = useState(false);

    const imageUrl = model.image?.thumbUrl ?? model.image?.url ?? null;
    const hasCarNumber = model.carNumber !== null;
    const hasDriver = !!model.driver;

    const card = (
        <Link className="card" id={model.slug} to={modelPath(model.slug)} state={linkState}>
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
        </Link>
    );

    if (!onQuickView) return card;

    return (
        <div className="cardShell" data-slug={model.slug}>
            {card}
            <div className="quickViewLayer">
                <button type="button" className="quickViewTrigger" onClick={() => onQuickView(model)}>
                    <Eye width={16} height={16}/>
                    <span>Quick view</span>
                    <span className="visuallyHidden">: {model.name}</span>
                </button>
            </div>
        </div>
    );
}
