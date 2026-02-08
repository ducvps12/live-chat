import { QueryClient } from '@tanstack/react-query';

// Configure QueryClient with default options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data cache time (5 minutes)
      staleTime: 5 * 60 * 1000,
      // Time to keep data in cache when no components are using it (10 minutes)
      gcTime: 10 * 60 * 1000,
      // Automatically refetch when window regains focus
      refetchOnWindowFocus: true,
      // Automatically refetch when network reconnects
      refetchOnReconnect: true,
      // Automatically refetch on mount
      refetchOnMount: true,
      // Number of retries when request fails
      retry: 1,
      // Delay between retries (1 second)
      retryDelay: 1000,
    },
    mutations: {
      // Number of retries when mutation fails
      retry: 1,
      // Delay between retries
      retryDelay: 1000,
    },
  },
});

