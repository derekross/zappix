import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// Extend Performance interface to include memory
declare global {
  interface Performance {
    memory?: MemoryInfo;
  }
}

export function useMemoryMonitor() {
  const queryClient = useQueryClient();
  const lastCleanupRef = useRef<number>(0);

  useEffect(() => {
    // Only run in development or if memory monitoring is explicitly enabled
    if (import.meta.env.PROD && !localStorage.getItem('enableMemoryMonitor')) {
      return;
    }

    const monitorMemory = () => {
      if (!performance.memory) return;

      const memory = performance.memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);

      // Only trigger cleanup if memory usage is critically high
      // Increased thresholds: above 500MB or above 90% of total heap
      const memoryPressure = usedMB > 500 || (usedMB / totalMB) > 0.9;
      const timeSinceLastCleanup = Date.now() - lastCleanupRef.current;

      if (memoryPressure && timeSinceLastCleanup > 60000) { // Wait at least 60 seconds between cleanups


        // Selective cleanup - only remove old unused cache entries instead of clearing everything
        const queryCache = queryClient.getQueryCache();
        const queries = queryCache.getAll();

        // Remove queries that haven't been used in the last 5 minutes
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

        queries.forEach((query) => {
          const lastFetch = query.state.dataUpdatedAt;
          const isStale = lastFetch < fiveMinutesAgo;
          const hasObservers = query.getObserversCount() === 0;

          // Only remove if it's stale AND has no active observers
          if (isStale && hasObservers) {
            queryCache.remove(query);
          }
        });


        // Force garbage collection if available (Chrome DevTools)
        if ('gc' in window && typeof window.gc === 'function') {
          window.gc();
        }

        lastCleanupRef.current = Date.now();
      }
    };

    // Monitor memory every 10 seconds
    const interval = setInterval(monitorMemory, 10000);

    return () => clearInterval(interval);
  }, [queryClient]);

  // Return memory info if available
  const getMemoryInfo = () => {
    if (!performance.memory) return null;

    const memory = performance.memory;
    return {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
    };
  };

  return { getMemoryInfo };
}