import {useEffect, useRef, useState} from "react";

// Shared open/close behavior for a <details>-based popover (FilterTrigger, SortTrigger): native
// <details> gives free keyboard toggling (Enter/Space on the summary) but supports neither
// Escape-to-close nor click-outside-to-close, so both are added here on top of it.
export function useDetailsPopover<T extends HTMLElement = HTMLDetailsElement>() {
    const [open, setOpen] = useState(false);
    const ref = useRef<T>(null);

    useEffect(() => {
        if (!open) return;

        const onDocumentClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setOpen(false);
            ref.current?.querySelector("summary")?.focus();
        };

        document.addEventListener("click", onDocumentClick);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("click", onDocumentClick);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    return {open, setOpen, ref};
}
