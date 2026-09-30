import {useState} from "react";

import {heroSubtitle} from "../../utils/collection-summary.ts";

import "./CollectionHero.css";

type CollectionHeroProps = {
    // null while the collection is loading (or failed) — the title then renders without a number
    // rather than a misleading "0".
    count: number | null;
    scales: string[];
    isLoading: boolean;
    // Decorative background photo. Optional: without it the hero falls back to a token-only
    // gradient treatment, so the page is complete before the owner supplies the asset.
    artUrl?: string | null;
};

export function CollectionHero({count, scales, isLoading, artUrl = null}: CollectionHeroProps) {
    const [artBroken, setArtBroken] = useState(false);
    const showArt = !!artUrl && !artBroken;

    return (
        <section className={`hero${showArt ? " heroWithArt" : ""}`} aria-labelledby="collectionHeroTitle">
            <div className="heroBackdrop" aria-hidden="true">
                {showArt && <img className="heroArt" src={artUrl} alt="" decoding="async" onError={() => setArtBroken(true)}/>}
            </div>

            <div className="heroContent">
                <p className="heroEyebrow">My collection</p>
                <h1 id="collectionHeroTitle" className="heroTitle">
                    {count !== null && <span className="heroCount">{count}</span>}
                    {isLoading && (
                        <>
                            <span className="heroCountSkeleton" aria-hidden="true"/>
                            <span className="visuallyHidden">Loading</span>
                        </>
                    )}
                    {" "}Diecast Models
                </h1>
                {/* Names a scale only once the loaded data confirms there's exactly one. */}
                <p className="heroSubtitle">{heroSubtitle(scales)}</p>
            </div>

            <p className="heroTagline">
                Small cars.<br/>Big stories.
            </p>
        </section>
    );
}
