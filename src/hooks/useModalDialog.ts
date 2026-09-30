// A native modal <dialog> for as long as the calling component is mounted (ROADMAP Phase 20 —
// Quick View and the lightbox). `showModal()` gives the rest for free: the page behind becomes
// inert (focus can't leave the dialog), Escape closes it, and it sits in the top layer, so a
// lightbox opened from Quick View simply stacks above it. On top of that this hook:
// - reports every way of closing (Escape, a close button, the backdrop) through one `onClose` —
//   the caller unmounts the component, and unmounting is what actually closes the dialog;
// - locks page scroll while any dialog is open (counted, so stacked dialogs don't unlock early);
// - returns focus to whatever opened it — browsers disagree on doing that themselves.
import {useEffect, useLayoutEffect, useRef, type MouseEvent, type PointerEvent} from "react";

const LOCK_CLASS = "modalOpen";
let openDialogs = 0;

function lockScroll() {
    openDialogs += 1;
    document.documentElement.classList.add(LOCK_CLASS);
}

function unlockScroll() {
    openDialogs = Math.max(0, openDialogs - 1);
    if (openDialogs === 0) document.documentElement.classList.remove(LOCK_CLASS);
}

export function useModalDialog(onClose: () => void) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const onCloseRef = useRef(onClose);
    const pressedBackdropRef = useRef(false);

    useLayoutEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        // jsdom (tests) has no showModal().
        if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
        lockScroll();

        // Escape arrives as `cancel`, synchronously — report it right away. `close` is only the
        // fallback for anything else that closes the dialog natively: it's delivered
        // asynchronously (Chrome holds it while the page isn't rendering), and a stale one — queued
        // by a previous cleanup's close(), since StrictMode mounts effects twice — can arrive after
        // the dialog was reopened, so it only counts while the dialog really is closed.
        const handleCancel = () => onCloseRef.current();
        const handleClose = () => {
            if (!dialog.open) onCloseRef.current();
        };
        dialog.addEventListener("cancel", handleCancel);
        dialog.addEventListener("close", handleClose);

        return () => {
            dialog.removeEventListener("cancel", handleCancel);
            dialog.removeEventListener("close", handleClose);
            if (dialog.open) dialog.close();
            unlockScroll();
            if (trigger?.isConnected) trigger.focus({preventScroll: true});
        };
    }, []);

    // The caller unmounts the dialog in onClose; the effect cleanup then closes it.
    const close = () => onCloseRef.current();

    // A click whose target is the <dialog> element itself landed on its ::backdrop (the content
    // wrapper fills the dialog box). Both press and release must be there, so a text selection
    // dragged out of the panel doesn't close it.
    const backdropProps = {
        onPointerDown: (event: PointerEvent<HTMLDialogElement>) => {
            pressedBackdropRef.current = event.target === event.currentTarget;
        },
        onClick: (event: MouseEvent<HTMLDialogElement>) => {
            if (pressedBackdropRef.current && event.target === event.currentTarget) close();
            pressedBackdropRef.current = false;
        },
    };

    return {dialogRef, close, backdropProps};
}
