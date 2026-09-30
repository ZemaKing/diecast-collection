import {useId, type ReactNode} from "react";

import {useModalDialog} from "../../hooks/useModalDialog.ts";

import "./ConfirmDialog.css";

type ConfirmDialogProps = {
    title: string;
    children: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    // Red confirm button — for actions that destroy something.
    danger?: boolean;
    busy?: boolean;
    // Shown under the text, e.g. why the last attempt failed.
    error?: string | null;
    onConfirm: () => void;
    // Escape, backdrop click and the cancel button all land here.
    onCancel: () => void;
};

// A yes/no question in a native modal <dialog> (Phase 25: delete a model, discard unsaved changes).
// Mount to open, unmount to close — like Quick View (useModalDialog). Focus starts on the safe
// choice, so Enter never destroys anything by accident; while `busy`, it can't be dismissed.
export function ConfirmDialog({title, children, confirmLabel, cancelLabel = "Cancel", danger, busy, error, onConfirm, onCancel}: ConfirmDialogProps) {
    const titleId = useId();
    const bodyId = useId();
    const {dialogRef, close, backdropProps} = useModalDialog(() => {
        if (!busy) onCancel();
    });

    return (
        <dialog
            ref={dialogRef}
            className="confirmDialog"
            role="alertdialog"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            aria-busy={busy || undefined}
            {...backdropProps}
            // While busy, Escape must not close the native dialog under a still-mounted component.
            onKeyDown={(event) => {
                if (busy && event.key === "Escape") event.preventDefault();
            }}
        >
            <div className="confirmDialogInner">
                <h2 id={titleId} className="confirmDialogTitle">{title}</h2>
                <div id={bodyId} className="confirmDialogBody">{children}</div>
                {error && <p className="confirmDialogError" role="alert">{error}</p>}
                <div className="confirmDialogActions">
                    <button type="button" className="confirmDialogButton" onClick={close} disabled={busy} autoFocus>
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`confirmDialogButton ${danger ? "confirmDialogDanger" : "confirmDialogPrimary"}`}
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
