import { QueryClient } from "@tanstack/react-query";

/**
 * Shared TanStack Query client for the entire application.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});
