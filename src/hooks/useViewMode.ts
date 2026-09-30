import {useCallback, useState} from "react";

import {getLocalStorage, readViewMode, writeViewMode, type ViewMode} from "../utils/view-mode.ts";

// The collection's grid/list/compact preference (ROADMAP Phase 18), persisted per browser in
// localStorage — deliberately not in the URL (see view-mode.ts).
export function useViewMode() {
    const [viewMode, setViewModeState] = useState<ViewMode>(() => readViewMode(getLocalStorage()));

    const setViewMode = useCallback((mode: ViewMode) => {
        setViewModeState(mode);
        writeViewMode(getLocalStorage(), mode);
    }, []);

    return {viewMode, setViewMode};
}
