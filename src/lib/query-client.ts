// One TanStack Query client for the app (Phase 9 decision — see ROADMAP notes: it gives caching,
// retry and loading/error states for free, instead of hand-rolling a `useEffect` + local-state
// hook per service call). Not consumed by any component yet — Phase 10 is the first caller.
import {QueryClient} from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
        },
    },
});
