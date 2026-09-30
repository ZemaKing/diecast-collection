import {useMutation, useQueryClient} from "@tanstack/react-query";
import {useNavigate} from "react-router-dom";

import {ConfirmDialog} from "../ConfirmDialog/ConfirmDialog.tsx";

import type {AppError} from "../../lib/errors.ts";
import {deleteModel, type DeleteModelResult} from "../../services/model-admin.ts";
import type {AdminNoticeState} from "../../utils/model-link.ts";

type DeleteModelDialogProps = {
    model: {slug: string; name: string};
    onClose: () => void;
    // Called right before leaving, so a form can let this navigation past its unsaved-changes guard.
    onDeleted?: () => void;
};

// "Delete this model?" (Phase 25) — from the details page and the edit form. On success the model's
// cached reads are dropped (collection, browse, statistics and the header count all come from the
// ["models", …] list) and the owner lands on the dashboard with a confirmation.
export function DeleteModelDialog({model, onClose, onDeleted}: DeleteModelDialogProps) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const mutation = useMutation<DeleteModelResult, AppError>({
        mutationFn: () => deleteModel(model.slug),
        onSuccess: (result) => {
            onDeleted?.();
            const notice = result.orphanedFiles.length > 0
                ? `Deleted “${model.name}”. ${result.orphanedFiles.length} photo file(s) couldn't be removed from Storage — delete them in the dashboard.`
                : `Deleted “${model.name}”.`;
            navigate("/admin", {replace: true, state: {adminNotice: notice} satisfies AdminNoticeState});
            // After leaving: the page that showed the model mustn't refetch it into a 404 on the way out.
            queryClient.removeQueries({queryKey: ["model", model.slug]});
            void queryClient.invalidateQueries({queryKey: ["models"]});
        },
    });

    return (
        <ConfirmDialog
            title={`Delete “${model.name}”?`}
            confirmLabel={mutation.isPending ? "Deleting…" : "Delete model"}
            danger
            busy={mutation.isPending}
            error={mutation.error?.message ?? null}
            onConfirm={() => mutation.mutate()}
            onCancel={onClose}
        >
            <p>It disappears from the collection, browse pages and statistics straight away, together with its colors, photos and notes.</p>
            <p>This can't be undone.</p>
        </ConfirmDialog>
    );
}
