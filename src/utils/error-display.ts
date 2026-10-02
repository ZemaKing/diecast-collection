// What an error state says (ROADMAP Phase 29). Pure, so every wording rule — offline vs. server
// unreachable vs. a paused Supabase project — is unit-tested instead of living inline in JSX.
import type {AppError} from "../lib/errors.ts";

export type ErrorVariant = "offline" | "unreachable" | "paused" | "unavailable" | "config" | "generic";

export type ErrorDisplay = {
    variant: ErrorVariant;
    title: string;
    message: string;
    // Worth showing a "Try again" button.
    canRetry: boolean;
};

// Supabase answers a paused project with HTTP 540 "Project paused" (free projects pause after a
// quiet week — ROADMAP open decision 10). Other 5xx mean overloaded / down for maintenance.
export function isPausedProject(error: AppError): boolean {
    if (error.status === 540) return true;
    const cause = error.cause as {message?: unknown} | null | undefined;
    return error.kind === "unavailable" && typeof cause?.message === "string" && /paused/i.test(cause.message);
}

// `online` is navigator.onLine: false is reliable ("definitely offline"), true only means "has a
// network" — so a network failure while online is the server being unreachable, which is also
// how a paused project looks when its answer lacks CORS headers.
export function describeError(error: AppError, {online}: {online: boolean}): ErrorDisplay {
    if (error.kind === "network" && !online) {
        return {
            variant: "offline",
            title: "You're offline",
            message: "Reconnect to the internet — this page tries again by itself once you're back online.",
            canRetry: true,
        };
    }

    if (error.kind === "network") {
        return {
            variant: "unreachable",
            title: "Can't reach the collection",
            message: "The server didn't answer. Check your connection, or try again in a moment — if it keeps happening, the collection's database may be paused.",
            canRetry: true,
        };
    }

    if (isPausedProject(error)) {
        return {
            variant: "paused",
            title: "The collection is taking a break",
            message: "Its database is paused after a quiet spell and needs to be woken up. Please check back a little later.",
            canRetry: true,
        };
    }

    if (error.kind === "unavailable") {
        return {
            variant: "unavailable",
            title: "The collection is temporarily unavailable",
            message: "The server is busy or down for maintenance. Please try again in a moment.",
            canRetry: true,
        };
    }

    if (error.kind === "config") {
        return {
            variant: "config",
            title: "The site isn't set up correctly",
            message: "It can't connect to its database. This needs fixing by the site owner.",
            canRetry: false,
        };
    }

    return {variant: "generic", title: "Something went wrong", message: error.message, canRetry: error.retryable};
}

// The route error boundary's copy: a lazily loaded page whose file is gone (a new deploy replaced
// it while the tab was open) is fixed by a reload; anything else is a bug.
export function isChunkLoadError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    return /dynamically imported module|importing a module script failed|error loading dynamically imported module|failed to fetch dynamically/i.test(message);
}
