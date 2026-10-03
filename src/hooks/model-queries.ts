// The published-model summary list (ROADMAP read strategy: load once, query in memory) — one
// definition for every reader (collection, browse, statistics, the header count, the admin form's
// suggestions) so they all share the one ["models", "cars"] cache entry. main.tsx starts it before
// the first render (Phase 33): every public page needs it, so it shouldn't wait for React.
import {queryOptions} from "@tanstack/react-query";

import type {AppError} from "../lib/errors.ts";
import {getModels} from "../services/models.ts";
import type {ModelSummary} from "../services/types.ts";

export const modelSummariesQuery = queryOptions<ModelSummary[], AppError>({
    queryKey: ["models", "cars"],
    queryFn: getModels,
});
