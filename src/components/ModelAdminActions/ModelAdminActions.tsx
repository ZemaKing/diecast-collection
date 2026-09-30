import {useState} from "react";
import {Link} from "react-router-dom";

import {DeleteModelDialog} from "./DeleteModelDialog.tsx";

import {editModelPath} from "../../utils/model-link.ts";

import "./ModelAdminActions.css";

// The details page's admin slot (Phase 25): a Draft badge when the model is hidden from visitors,
// Edit and Delete. Rendered only for admins — hiding it is a convenience, RLS is the gate.
export function ModelAdminActions({model}: {model: {slug: string; name: string; isPublished: boolean}}) {
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    return (
        <div className="modelAdminActions">
            {!model.isPublished && <span className="modelAdminDraft" title="Hidden from visitors until published">Draft</span>}
            <Link to={editModelPath(model.slug)} className="modelAdminButton">Edit</Link>
            <button type="button" className="modelAdminButton modelAdminDelete" onClick={() => setConfirmingDelete(true)}>
                Delete
            </button>
            {confirmingDelete && <DeleteModelDialog model={model} onClose={() => setConfirmingDelete(false)}/>}
        </div>
    );
}
