// The app's one loading / empty / error vocabulary (ROADMAP Phase 29). Every page renders these
// instead of ad-hoc markup, so a failure or an empty result looks and reads the same everywhere.
import type {ReactNode} from "react";

import {useOnlineStatus} from "../../hooks/useOnlineStatus.ts";
import type {AppError} from "../../lib/errors.ts";
import {describeError, type ErrorVariant} from "../../utils/error-display.ts";
import {StateIcon} from "./StateIcon.tsx";

import "./States.css";

type SkeletonProps = {
    className?: string;
    // "line" is a text-line placeholder (pair with skeletonBarTitle / skeletonBarMeta for width).
    variant?: "block" | "line";
    as?: "div" | "span";
};

// A shimmering placeholder. Size and shape come from the caller's class, so a skeleton keeps the
// same box model as what replaces it (no reflow when data lands). Always hidden from assistive
// tech — the region that's loading says so in words (aria-busy / "Loading…").
export function Skeleton({className, variant = "block", as: Tag = "span"}: SkeletonProps) {
    const base = variant === "line" ? "skeleton skeletonBar" : "skeleton";
    return <Tag className={className ? `${base} ${className}` : base} aria-hidden="true"/>;
}

type EmptyStateProps = {
    title: string;
    children?: ReactNode;
    // Buttons/links that get the reader out of the empty state ("Clear filters").
    actions?: ReactNode;
    icon?: "search" | "filter" | "collection";
    // Inside a card or table rather than a page's main area.
    compact?: boolean;
};

export function EmptyState({title, children, actions, icon = "collection", compact = false}: EmptyStateProps) {
    return (
        <div className={`stateBox stateBox-empty${compact ? " stateBoxCompact" : ""}`}>
            {!compact && <StateIcon name={icon}/>}
            <p className="stateTitle">{title}</p>
            {children && <div className="stateMessage">{children}</div>}
            {actions && <div className="stateActions">{actions}</div>}
        </div>
    );
}

type ErrorStateProps = {
    error: AppError;
    onRetry?: () => void;
    // The retry is in flight (query.isFetching) — the button says so and can't be pressed twice.
    retrying?: boolean;
    // Overrides the generic title for a known context ("Couldn't load drafts").
    title?: string;
    compact?: boolean;
};

const VARIANT_ICON: Record<ErrorVariant, "offline" | "paused" | "error"> = {
    offline: "offline",
    unreachable: "offline",
    paused: "paused",
    unavailable: "paused",
    config: "error",
    generic: "error",
};

// A failed read, worded for its cause (offline, server unreachable, paused project, …) — the copy
// is `describeError()`'s. role="alert" so a failure that replaces a loading state is announced.
export function ErrorState({error, onRetry, retrying = false, title, compact = false}: ErrorStateProps) {
    const online = useOnlineStatus();
    const display = describeError(error, {online});
    const showRetry = !!onRetry && display.canRetry;

    return (
        <div className={`stateBox stateBox-error${compact ? " stateBoxCompact" : ""}`} role="alert" data-variant={display.variant}>
            {!compact && <StateIcon name={VARIANT_ICON[display.variant]}/>}
            <p className="stateTitle">{title ?? display.title}</p>
            <p className="stateMessage">{display.message}</p>
            {showRetry && (
                <div className="stateActions">
                    <button type="button" className="stateButton stateButtonPrimary" onClick={onRetry} disabled={retrying}>
                        {retrying ? "Trying again…" : "Try again"}
                    </button>
                </div>
            )}
        </div>
    );
}

// App-wide notice while the browser is offline: pages keep showing what's already loaded (cached
// queries), and anything new fails into an ErrorState that retries on reconnect.
export function OfflineBanner() {
    const online = useOnlineStatus();
    return (
        <div role="status" aria-live="polite">
            {!online && (
                <p className="offlineBanner">
                    <span className="offlineBannerDot" aria-hidden="true"/>
                    You're offline — showing what's already loaded.
                </p>
            )}
        </div>
    );
}

type ImagePlaceholderProps = {
    // "missing": the model has no photo yet; "broken": it has one that failed to load.
    reason: "missing" | "broken";
    // Small thumbnails (list/compact rows, form tiles) show the icon only.
    size?: "regular" | "small";
    className?: string;
};

// The missing-photo picture (ROADMAP Phase 29 — the legacy data's `COMING_SOON` image, as a local,
// themeable asset instead of a postimg URL). Decorative: the card/gallery around it names the model.
export function ImagePlaceholder({reason, size = "regular", className}: ImagePlaceholderProps) {
    const label = reason === "missing" ? "Photo coming soon" : "Image unavailable";

    return (
        <span className={`imagePlaceholder imagePlaceholder-${size}${className ? ` ${className}` : ""}`} aria-hidden="true">
            <svg className="imagePlaceholderArt" viewBox="0 0 120 56" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                {/* A side-on coupe: body, cabin glass, two wheels. */}
                <path d="M6 40v-8c0-2 1.5-3.5 3.5-4l14-3 14-11c2-1.5 4-2 6.5-2h26c2.5 0 4.5 1 6 3l9 10 16 3c2.5.5 4 2.5 4 5v7c0 2-1.5 3.5-3.5 3.5h-6"/>
                <path d="M33 43.5h50"/>
                <path d="M6 40c0 2 1.5 3.5 3.5 3.5H13"/>
                <path d="M42 25l10-8h14v8z"/>
                <path d="M72 17h8.5l6.5 8H72z"/>
                <circle cx="23" cy="43" r="8"/>
                <circle cx="93" cy="43" r="8"/>
            </svg>
            {size === "regular" && <span className="imagePlaceholderLabel">{label}</span>}
        </span>
    );
}
