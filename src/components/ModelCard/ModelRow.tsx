import {useState} from "react";
import {Link} from "react-router-dom";

import {ColorCircle} from "../ColorCircle/ColorCircle";
import {CategoryLabel} from "../CategoryLabel/CategoryLabel";
import {LogoOrText} from "./LogoOrText.tsx";

import type {ModelSummary} from "../../services/types.ts";
import {countryCodeToFlagEmoji} from "../../utils/model-display.ts";
import {modelPath, type ModelLinkState} from "../../utils/model-link.ts";

import "./ModelCard.css";
import "./ModelRow.css";
import {ImagePlaceholder, Skeleton} from "../States/States.tsx";

// The List and Compact collection views (ROADMAP Phase 18). Same ModelSummary data as ModelCard,
// same whole-row-is-one-link interaction (to the details page) and `id={slug}` (the collection
// brings it back into view on return), just laid out as rows. Markup is phrasing content only
// (spans), which keeps the rows valid whether they're links or buttons.

type ModelRowProps = {
    model: ModelSummary;
    linkState?: ModelLinkState;
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
                <ImagePlaceholder reason={imageUrl ? "broken" : "missing"} size="small"/>
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

export function ModelListRow({model, linkState}: ModelRowProps) {
    return (
        <Link className="listRow" id={model.slug} to={modelPath(model.slug)} state={linkState}>
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
        </Link>
    );
}

export function ModelCompactRow({model, linkState}: ModelRowProps) {
    return (
        <Link className="compactRow" id={model.slug} to={modelPath(model.slug)} state={linkState}>
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
        </Link>
    );
}

// Loading placeholders with the same box model as the real rows, so switching data in doesn't
// shift the page (the grid equivalent is ModelCardSkeleton).
export function ModelRowSkeleton({variant}: {variant: "list" | "compact"}) {
    if (variant === "list") {
        return (
            <div className="listRow rowSkeleton" aria-hidden="true">
                <Skeleton className="listRowThumb"/>
                <span className="listRowBody">
                    <Skeleton variant="line" className="skeletonBarTitle"/>
                    <Skeleton variant="line" className="skeletonBarMeta"/>
                </span>
            </div>
        );
    }

    return (
        <div className="compactRow rowSkeleton" aria-hidden="true">
            <Skeleton className="compactThumb"/>
            <span className="compactMain">
                <Skeleton variant="line" className="skeletonBarTitle"/>
            </span>
        </div>
    );
}
