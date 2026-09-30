import type {ReactNode} from "react";

import "./PageIntro.css";

type PageIntroProps = {
    eyebrow: string;
    title: string;
    // Omitted while loading — a non-breaking space keeps the line's height, so nothing shifts.
    subtitle?: string | null;
    // Controls on the right (e.g. the browse index's order toggle).
    children?: ReactNode;
};

// The heading block of a top-level page: eyebrow, <h1>, subtitle (Phase 22/23).
export function PageIntro({eyebrow, title, subtitle, children}: PageIntroProps) {
    return (
        <header className="pageIntro">
            <div>
                <p className="pageEyebrow">{eyebrow}</p>
                <h1 className="pageTitle">{title}</h1>
                <p className="pageSubtitle">{subtitle ?? " "}</p>
            </div>
            {children}
        </header>
    );
}
