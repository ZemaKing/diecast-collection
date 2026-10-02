import "./ModelCard.css";
import {Skeleton} from "../States/States.tsx";

// Same shape/dimensions as ModelCard, so the grid doesn't jump when real cards replace these.
export function ModelCardSkeleton() {
    return (
        <div className="card cardSkeleton" aria-hidden="true">
            <Skeleton as="div" className="thumb"/>
            <div className="cardTitle">
                <Skeleton variant="line" className="skeletonBarTitle"/>
            </div>
            <div className="cardMeta">
                <Skeleton variant="line" className="skeletonBarMeta"/>
            </div>
        </div>
    );
}
