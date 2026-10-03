// The header's "N models" count (Phase 24; read by the Header itself since Phase 30). Shares the
// ["models", "cars"] cache, so it's free once anything has loaded it. `null` until the list has
// loaded — while it's loading or failed the header shows no number rather than "0 models".
import {useQuery} from "@tanstack/react-query";

import {getModels} from "../services/models.ts";

export function useModelCount(): number | null {
    const {data} = useQuery({queryKey: ["models", "cars"], queryFn: getModels});
    return data ? data.length : null;
}
