import {useState} from "react";

import {ColorCircle} from "../ColorCircle/ColorCircle";
import {CategoryLabel} from "../CategoryLabel/CategoryLabel";
import {LogoOrText} from "./LogoOrText.tsx";

import type {ModelSummary} from "../../services/types.ts";
import {countryCodeToFlagEmoji} from "../../utils/model-display.ts";

import "./ModelCard.css";
import "./ModelRow.css";

// The List and Compact collection views (ROADMAP Phase 18). Same ModelSummary data as ModelCard,
// same whole-row-is-one-button interaction and `id={slug}` (the ?model= deep link scrolls to it),
// just laid out as rows. Markup is phrasing content only (spans), since it lives inside <button>.

type ModelRowProps = {
    model: ModelSummary;
    onClick: () => void;
};

function RowThumb({model, className, children}: {model: ModelSummary; className: string; children?: React.ReactNode}) {
    const [broken, setBroken] = useState(false);
    const imageUrl = model.image?.thumbUrl ?? model.image?.url ?? null;

    return (
        <span className={className}>
            {imageUrl && !broken ? (
                <img
                    src={imageUrl}
                    alt={`${model.name} (${model.year})`}
                    loading="lazy"
                    decoding="async"
                    onError={() => setBroken(true)}
                />
            ) : (
                <span className="rowThumbFallback" aria-hidden="true">{model.name}</span>
            )}
            {children}
        </span>
    );
}

// Car number and/or driver, inline — rendered only for the combinations that exist (audit D7).
function RacingInline({model}: {model: ModelSummary}) {
    if (model.carNumber === null && !model.driver) return null;

    return (
        <span className="rowRacing">
            {model.carNumber !== null && <span className="rowRacingNumber">#{model.carNumber}</span>}
            {model.driver && (
                <span className="rowRacingDriver">
                    <img className="rowRacingWheel" src="/wheel.svg" alt="" aria-hidden="true"/>
                    <span className="rowRacingDriverName">{model.driver.name}</span>
                    {model.driver.countryCode && <span aria-hidden="true">{countryCodeToFlagEmoji(model.driver.countryCode)}</span>}
                </span>
            )}
        </span>
    );
}

export function ModelListRow({model, onClick}: ModelRowProps) {
    return (
        <button type="button" className="listRow" id={model.slug} onClick={onClick}>
            <RowThumb model={model} className="listRowThumb">
                {/* Below tablet the aside column is dropped to give the title room; the scale
                    moves onto the photo instead, as on the grid card. */}
                <span className="scaleBadge listRowThumbScale">{model.scale}</span>
            </RowThumb>

            <span className="listRowBody">
                <span className="listRowTitle">
                    <span className="listRowName">{model.name}</span>
                    {model.liveryHex.length > 0 && <ColorCircle hex={model.liveryHex}/>}
                </span>

                <span className="cardMeta">
                    <LogoOrText logoPath={model.brand.logoPath} name={model.brand.name} imgClassName="brandLogo" textClassName="cardMetaText"/>
                    <span aria-hidden="true">•</span>
                    <span>{model.year}</span>
                    <span aria-hidden="true">•</span>
                    <span>{model.manufacturer.name}</span>
                    <span aria-hidden="true">•</span>
                    <CategoryLabel category={model.category.name}/>
                </span>

                <RacingInline model={model}/>
            </span>

            <span className="listRowAside">
                <span className="listRowManufacturer">
                    <LogoOrText logoPath={model.manufacturer.logoPath} name={model.manufacturer.name} textClassName="listRowManufacturerText"/>
                </span>
                <span className="rowScale">{model.scale}</span>
            </span>
        </button>
    );
}

export function ModelCompactRow({model, onClick}: ModelRowProps) {
    return (
        <button type="button" className="compactRow" id={model.slug} onClick={onClick}>
            <RowThumb model={model} className="compactThumb"/>

            <span className="compactMain">
                <span className="compactName">
                    <span className="compactNameText">{model.name}</span>
                    {model.liveryHex.length > 0 && <ColorCircle hex={model.liveryHex}/>}
                </span>
                {/* Mobile only — the tablet+ columns below carry the same fields. */}
                <span className="compactSub">{model.year} · {model.manufacturer.name}</span>
            </span>

            <span className="compactCell compactBrand">{model.brand.name}</span>
            <span className="compactCell compactYear">{model.year}</span>
            <span className="compactCell compactManufacturer">{model.manufacturer.name}</span>
            <span className="compactCell compactRacingCell"><RacingInline model={model}/></span>
            <span className="compactCategory"><CategoryLabel category={model.category.name}/></span>
        </button>
    );
}

// Loading placeholders with the same box model as the real rows, so switching data in doesn't
// shift the page (the grid equivalent is ModelCardSkeleton).
export function ModelRowSkeleton({variant}: {variant: "list" | "compact"}) {
    if (variant === "list") {
        return (
            <div className="listRow rowSkeleton" aria-hidden="true">
                <span className="listRowThumb thumbSkeleton"/>
                <span className="listRowBody">
                    <span className="skeletonBar skeletonBarTitle"/>
                    <span className="skeletonBar skeletonBarMeta"/>
                </span>
            </div>
        );
    }

    return (
        <div className="compactRow rowSkeleton" aria-hidden="true">
            <span className="compactThumb thumbSkeleton"/>
            <span className="compactMain">
                <span className="skeletonBar skeletonBarTitle"/>
            </span>
        </div>
    );
}
