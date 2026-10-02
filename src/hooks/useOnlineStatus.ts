import {useSyncExternalStore} from "react";

function subscribe(onChange: () => void) {
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
    };
}

// navigator.onLine, live (ROADMAP Phase 29). false = definitely offline; true = has a network,
// which says nothing about whether the server answers.
export function useOnlineStatus(): boolean {
    return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
