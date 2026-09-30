import {Link} from "react-router-dom";

import {ChevronRight} from "../../icons/ChevronRight.tsx";
import {Home} from "../../icons/Home.tsx";

import "./Breadcrumb.css";

export type Crumb = {
    label: string;
    // Omitted on the last crumb — the current page.
    to?: string;
    state?: unknown;
};

// `Collection` (with the home icon) is always the first crumb; `trail` is everything after it,
// ending with the current page (ROADMAP Phase 19, shared with the browse pages in Phase 22).
export function Breadcrumb({home, trail}: {home: {to: string; state?: unknown}; trail: Crumb[]}) {
    return (
        <nav className="breadcrumb" aria-label="Breadcrumb">
            <ol>
                <li>
                    <Link to={home.to} state={home.state} className="breadcrumbLink">
                        <Home width={16} height={16}/>
                        <span>Collection</span>
                    </Link>
                </li>
                {trail.map((crumb, index) => (
                    <li key={`${index}:${crumb.label}`}>
                        <ChevronRight className="breadcrumbSeparator" width={14} height={14}/>
                        {crumb.to ? (
                            <Link to={crumb.to} state={crumb.state} className="breadcrumbLink">{crumb.label}</Link>
                        ) : (
                            <span aria-current="page" className="breadcrumbCurrent">{crumb.label}</span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}
