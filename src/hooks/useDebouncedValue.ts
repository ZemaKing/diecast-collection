import {useEffect, useState} from "react";

// `value`, once it has stopped changing for `delay` ms — so a lookup that follows typing (the model
// form's "address already taken" check, Phase 25) runs once per pause, not once per keystroke.
export function useDebouncedValue<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}
