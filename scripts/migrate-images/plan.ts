// Pure planning for the flip (model_images → Storage paths) and its rollback. Unit-tested.
import {plannedPaths} from "../images/batch.ts";
import {isDone, type Manifest, type ManifestEntry} from "../images/manifest.ts";
import type {ImageJob} from "../images/types.ts";
import {rowToSource, sourceKey, type ImageRow} from "./job.ts";

export type FlipRow = {
    id: string;
    storage_path: string | null;
    thumb_storage_path: string | null;
    width?: number;
    height?: number;
};

export type FlipPlan = {
    rows: FlipRow[]; // payload for diecast.set_image_storage()
    objects: Record<string, ManifestEntry>; // what must verify before flipping
    problems: string[]; // any problem blocks the flip
    unchanged: number; // rows already pointing at the planned paths
};

const THUMB = "thumb";

// Flip every row that still has an external_url to its uploaded objects. A row is only ready when
// every variant is in the manifest, uploaded from that row's current external_url with the job's
// current settings — otherwise the flip is blocked (all rows or none, per the DoD).
export function planFlip(job: ImageJob, rows: ImageRow[], manifest: Manifest): FlipPlan {
    const plan: FlipPlan = {rows: [], objects: {}, problems: [], unchanged: 0};
    for (const row of rows) {
        const source = rowToSource(row);
        if (!source) continue; // Storage-only image (Phase 27) — nothing to flip
        const planned = plannedPaths(job, source);
        const missing = planned.filter(({path, variant}) => !isDone(manifest, path, source, variant));
        if (missing.length) {
            const why = missing.map(({path}) =>
                manifest.objects[path] ? `${path} was uploaded from another URL or with other settings` : `${path} not uploaded`);
            plan.problems.push(`${source.key}: ${why.join("; ")}`);
            continue;
        }
        const full = planned.find(({variant}) => variant.name !== THUMB) ?? planned[0];
        const thumb = planned.find(({variant}) => variant.name === THUMB) ?? full;
        const fullEntry = manifest.objects[full.path];
        for (const {path} of planned) plan.objects[path] = manifest.objects[path];
        if (row.storage_path === full.path && row.thumb_storage_path === thumb.path) {
            plan.unchanged++;
            continue;
        }
        plan.rows.push({id: row.id, storage_path: full.path, thumb_storage_path: thumb.path, width: fullEntry.width, height: fullEntry.height});
    }
    return plan;
}

// Back to postimg: clear the Storage paths. Only possible where external_url is still set.
export function planRollback(rows: ImageRow[]): FlipPlan {
    const plan: FlipPlan = {rows: [], objects: {}, problems: [], unchanged: 0};
    for (const row of rows) {
        if (!row.storage_path && !row.thumb_storage_path) {
            plan.unchanged++;
        } else if (!row.external_url) {
            plan.problems.push(`${sourceKey(row)}: no external_url to fall back to — left on Storage`);
        } else {
            plan.rows.push({id: row.id, storage_path: null, thumb_storage_path: null});
        }
    }
    return plan;
}
