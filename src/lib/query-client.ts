// One TanStack Query client for the app (Phase 9 decision — see ROADMAP notes: it gives caching,
// retry and loading/error states for free, instead of hand-rolling a `useEffect` + local-state
// hook per service call).
import {QueryClient, type QueryClientConfig} from "@tanstack/react-query";

// Exported for the test that pins the offline behavior (query-client.test.ts).
export const queryClientConfig: QueryClientConfig = {
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
            // "always" (Phase 29): offline, a request fails fast into the page's ErrorState ("You're
            // offline") instead of TanStack's default of pausing — which leaves a skeleton up
            // forever. A failed query still refetches by itself on reconnect — explicitly, since
            // TanStack turns refetchOnReconnect off by default under "always".
            networkMode: "always",
            refetchOnReconnect: true,
        },
        mutations: {
            // Same for writes: a Save offline reports "Can't reach the server" rather than
            // hanging on "Saving…".
            networkMode: "always",
        },
    },
};

export const queryClient = new QueryClient(queryClientConfig);
