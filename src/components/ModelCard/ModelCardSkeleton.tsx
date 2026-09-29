import "./ModelCard.css";

// Same shape/dimensions as ModelCard, so the grid doesn't jump when real cards replace these.
export function ModelCardSkeleton() {
    return (
        <div className="card cardSkeleton" aria-hidden="true">
            <div className="thumb thumbSkeleton"/>
            <div className="cardTitle">
                <span className="skeletonBar skeletonBarTitle"/>
            </div>
            <div className="cardMeta">
                <span className="skeletonBar skeletonBarMeta"/>
            </div>
        </div>
    );
}
