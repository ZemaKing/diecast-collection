// The header's "N models" pill on pages that don't otherwise need the model list (Phase 24's
// login/admin pages). Shares the ["models", "cars"] cache, so it's free once anything has loaded it.
import {useQuery} from "@tanstack/react-query";

import {getModels} from "../services/models.ts";

export function useModelCount(): number {
    const {data} = useQuery({queryKey: ["models", "cars"], queryFn: getModels});
    return data?.length ?? 0;
}
