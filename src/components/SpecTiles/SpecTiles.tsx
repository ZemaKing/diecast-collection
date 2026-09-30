import {useState, type ReactNode} from "react";
import {Link} from "react-router-dom";

import {CategoryLabel} from "../CategoryLabel/CategoryLabel";
import {ColorCircle} from "../ColorCircle/ColorCircle";

import {Calendar} from "../../icons/Calendar.tsx";
import {Car} from "../../icons/Car.tsx";
import {ChevronRight} from "../../icons/ChevronRight.tsx";
import {Scale} from "../../icons/Scale.tsx";
import type {ModelSummary} from "../../services/types.ts";
import {browsePath} from "../../utils/browse-link.ts";
import {logoSrc} from "../../utils/model-display.ts";
import {formatColors} from "../../utils/model-details.ts";

import "./SpecTiles.css";

type SpecTilesModel = Pick<ModelSummary, "brand" | "manufacturer" | "category" | "scale" | "colors" | "liveryHex" | "year">;

type SpecTilesProps = {
    model: SpecTilesModel;
    // "all" (details page): Brand/Manufacturer open their browse pages (Phase 22), Category the
    // collection filtered to it. "browse" (Quick View): only the browse links — they leave the
    // collection, so the dialog closes with it; a category link would instead re-filter the page
    // behind the still-open dialog. Omitted: plain tiles.
    linked?: "all" | "browse";
};

function categoryFilterPath(slug: string): string {
    return `/?category=${encodeURIComponent(slug)}`;
}

// The six key facts (ROADMAP Phase 19; shared with Quick View in Phase 20).
export function SpecTiles({model, linked}: SpecTilesProps) {
    return (
        <ul className="specTiles" aria-label="Key specifications">
            <SpecTile label="Brand" to={linked ? browsePath("brands", model.brand.slug) : undefined} linkHint={`all ${model.brand.name} models`}>
                <TileLogo logoPath={model.brand.logoPath}/>
                <span>{model.brand.name}</span>
            </SpecTile>
            <SpecTile label="Manufacturer" to={linked ? browsePath("manufacturers", model.manufacturer.slug) : undefined} linkHint={`all ${model.manufacturer.name} models`}>
                <TileLogo logoPath={model.manufacturer.logoPath}/>
                <span>{model.manufacturer.name}</span>
            </SpecTile>
            <SpecTile label="Category" to={linked === "all" ? categoryFilterPath(model.category.slug) : undefined} linkHint={`all ${model.category.name} models`}>
                <Car className="specTileIcon" width={18} height={18}/>
                <CategoryLabel category={model.category.name}/>
            </SpecTile>
            <SpecTile label="Scale">
                <Scale className="specTileIcon" width={18} height={18}/>
                <span>{model.scale}</span>
            </SpecTile>
            <SpecTile label={model.colors.length > 1 ? "Colors" : "Color"}>
                {model.liveryHex.length > 0 && <ColorCircle hex={model.liveryHex}/>}
                <span>{formatColors(model) ?? "—"}</span>
            </SpecTile>
            <SpecTile label="Year">
                <Calendar className="specTileIcon" width={18} height={18}/>
                <span>{model.year}</span>
            </SpecTile>
        </ul>
    );
}

type SpecTileProps = {
    label: string;
    children: ReactNode;
    to?: string;
    linkHint?: string;
};

function SpecTile({label, to, linkHint, children}: SpecTileProps) {
    const body = (
        <>
            <span className="specTileLabel">{label}</span>
            <span className="specTileValue">{children}</span>
        </>
    );

    return (
        <li className="specTile">
            {to ? (
                <Link to={to} className="specTileInner specTileLink">
                    {body}
                    {linkHint && <span className="visuallyHidden"> — show {linkHint}</span>}
                    <ChevronRight className="specTileArrow" width={14} height={14}/>
                </Link>
            ) : (
                <div className="specTileInner">{body}</div>
            )}
        </li>
    );
}

// Decorative (the name is right next to it); a missing or broken logo simply isn't shown.
function TileLogo({logoPath}: {logoPath: string | null}) {
    const [broken, setBroken] = useState(false);
    const src = logoSrc(logoPath);
    if (!src || broken) return null;
    return <img className="specTileLogo" src={src} alt="" aria-hidden="true" onError={() => setBroken(true)}/>;
}

// Same box model as the loaded tiles (the details page's loading state).
export function SpecTilesSkeleton() {
    return (
        <ul className="specTiles" aria-hidden="true">
            {["a", "b", "c", "d", "e", "f"].map((key) => <li key={key} className="specTile specTileSkeleton"/>)}
        </ul>
    );
}
