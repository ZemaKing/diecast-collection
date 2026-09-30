import {Link} from "react-router-dom";

import {LogoOrText} from "../ModelCard/LogoOrText.tsx";

import {ChevronRight} from "../../icons/ChevronRight.tsx";
import type {BrowseEntry, BrowseKind} from "../../services/browse.ts";
import type {FacetCount} from "../../services/collection-query.ts";
import {browsePath} from "../../utils/browse-link.ts";
import {describeCategories, formatRelated, formatYears} from "../../utils/browse-display.ts";
import {categoryColorVar} from "../../utils/category.ts";
import {pluralizeModels} from "../../utils/collection-summary.ts";

import "../ModelCard/ModelCard.css";
import "./Browse.css";

// Shared building blocks of the manufacturer and brand pages (ROADMAP Phase 22) — the same
// pattern for both, fed by getBrowseEntries()/getBrowseEntry().

// The logo on a sunken plate (logos are drawn for light *and* dark backgrounds, and the plate
// gives every tile the same footprint); the name as text when there's no logo or it fails.
// Hidden from assistive tech: the name is always written right next to it.
export function BrowseLogo({entry, size}: {entry: Pick<BrowseEntry, "logoPath" | "name">; size: "tile" | "profile"}) {
    return (
        <div className={`browseLogo browseLogo-${size}`} aria-hidden="true">
            <LogoOrText logoPath={entry.logoPath} name={entry.name} imgClassName="browseLogoImg" textClassName="browseLogoText"/>
        </div>
    );
}

// Proportional strip of the categories represented, in each category's own color. Decorative —
// the same numbers are given as text (visually hidden on tiles, as the legend on the profile).
export function CategoryMixBar({categories, total}: {categories: FacetCount[]; total: number}) {
    return (
        <div className="categoryMix" aria-hidden="true">
            {categories.map((c) => (
                <span
                    key={c.slug}
                    className="categoryMixSegment"
                    style={{flexGrow: c.count, flexBasis: 0, background: categoryColorVar(c.name)}}
                    title={`${c.name}: ${c.count} of ${total}`}
                />
            ))}
        </div>
    );
}

export function BrowseTile({kind, entry}: {kind: BrowseKind; entry: BrowseEntry}) {
    return (
        <Link className="browseTile" to={browsePath(kind, entry.slug)}>
            <BrowseLogo entry={entry} size="tile"/>
            <div className="browseTileBody">
                <div className="browseTileHeading">
                    <span className="browseTileName">{entry.name}</span>
                    <span className="browseTileCount">
                        {entry.count} <span className="browseTileCountUnit">{pluralizeModels(entry.count)}</span>
                    </span>
                </div>
                <CategoryMixBar categories={entry.categories} total={entry.count}/>
                <span className="visuallyHidden">Categories: {describeCategories(entry.categories)}.</span>
                <span className="browseTileMeta">
                    {formatYears(entry.years)}
                    <span aria-hidden="true"> · </span>
                    {formatRelated(kind, entry.relatedCount)}
                </span>
            </div>
            <ChevronRight className="browseTileArrow" width={16} height={16}/>
        </Link>
    );
}

// Same box model as BrowseTile, so the grid doesn't reflow when the data lands.
export function BrowseTileSkeleton() {
    return (
        <div className="browseTile browseTileSkeleton" aria-hidden="true">
            <div className="browseLogo browseLogo-tile thumbSkeleton"/>
            <div className="browseTileBody">
                <span className="skeletonBar skeletonBarTitle"/>
                <span className="skeletonBar skeletonBarMeta"/>
            </div>
        </div>
    );
}
