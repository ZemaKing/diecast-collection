type StateIconName = "search" | "filter" | "collection" | "offline" | "paused" | "error";

// Line icons for the state boxes (24px grid, currentColor) — decorative, the title says it all.
export function StateIcon({name}: {name: StateIconName}) {
    return (
        <span className={`stateIcon stateIcon-${name}`} aria-hidden="true">
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                {PATHS[name]}
            </svg>
        </span>
    );
}

const PATHS: Record<StateIconName, React.ReactNode> = {
    search: (
        <>
            <circle cx="11" cy="11" r="7"/>
            <path d="M20 20l-3.5-3.5"/>
            <path d="M8.5 11h5"/>
        </>
    ),
    filter: (
        <>
            <path d="M3 5h18l-7 8v6l-4-2v-4z"/>
        </>
    ),
    collection: (
        <>
            <path d="M5 16H3v-4l2-5h14l2 5v4h-2"/>
            <path d="M3 12h18"/>
            <circle cx="7.5" cy="16.5" r="1.5"/>
            <circle cx="16.5" cy="16.5" r="1.5"/>
            <path d="M9 16.5h6"/>
        </>
    ),
    offline: (
        <>
            <path d="M2 8.5a15 15 0 0 1 5-3"/>
            <path d="M10.5 4.6A15 15 0 0 1 22 8.5"/>
            <path d="M5 12a10 10 0 0 1 4-2.4"/>
            <path d="M15 10a10 10 0 0 1 4 2"/>
            <path d="M8.5 15.5a5 5 0 0 1 7 0"/>
            <path d="M12 19h.01"/>
            <path d="M3 3l18 18"/>
        </>
    ),
    paused: (
        <>
            <circle cx="12" cy="12" r="9"/>
            <path d="M10 9v6"/>
            <path d="M14 9v6"/>
        </>
    ),
    error: (
        <>
            <path d="M12 3l9.5 17h-19z"/>
            <path d="M12 10v4"/>
            <path d="M12 17h.01"/>
        </>
    ),
};
