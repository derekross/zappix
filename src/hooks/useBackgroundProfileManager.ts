import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Silent background profile management
 * Handles stuck queries and retries automatically without user notifications
 */
export function useBackgroundProfileManager() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const manageProfileQueries = () => {
      const queries = queryClient.getQueryCache().getAll();
      const now = Date.now();
      let cancelledCount = 0;
      let retriedCount = 0;

      queries.forEach(query => {
        // Only manage author/profile queries
        if (query.queryKey[0] !== 'author' && query.queryKey[0] !== 'authors') {
          return;
        }

        const isLoading = query.state.fetchStatus === 'fetching';
        const isError = query.state.status === 'error';
        const lastFetch = query.state.dataUpdatedAt || query.state.errorUpdatedAt || 0;
        const timeSinceLastUpdate = now - lastFetch;

        // Cancel queries that have been stuck loading for more than 15 seconds
        if (isLoading && timeSinceLastUpdate > 15000) {
          queryClient.cancelQueries({ queryKey: query.queryKey });
          cancelledCount++;

      }

      // Retry failed queries that haven't been retried recently (5 minutes)
      if (isError && timeSinceLastUpdate > 300000) {
        queryClient.invalidateQueries({ queryKey: query.queryKey });
        retriedCount++;
      }
    });

    // Log summary only in development
    if (import.meta.env.DEV && (cancelledCount > 0 || retriedCount > 0)) {
      console.debug(`Profile query manager: cancelled ${cancelledCount}, retried ${retriedCount}`);
    }
    };

    // Check every 30 seconds (less aggressive than the old system)
    const interval = setInterval(manageProfileQueries, 30000);

    // Initial check after 10 seconds to let the app settle
    const initialTimeout = setTimeout(manageProfileQueries, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [queryClient]);

  // This hook doesn't return anything - it's purely for background management
}