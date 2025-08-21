import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useEffect } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';

interface OptimizedContentLoaderOptions {
  queryKey: string[];
  queryFn: (params: { pageParam?: number; signal: AbortSignal }) => Promise<{
    events: NostrEvent[];
    nextCursor?: number;
  }>;
  initialPageParam?: number;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
}

// Optimized content loader with performance improvements
export function useOptimizedContentLoader(options: OptimizedContentLoaderOptions) {
  const queryClient = useQueryClient();
  const prefetchTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Use infinite query with optimized settings
  const query = useInfiniteQuery({
    queryKey: options.queryKey,
    queryFn: async ({ pageParam, signal }) => {
      // Create optimized signal with timeout
      const optimizedSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(10000) // 10 second timeout
      ]);

      const result = await options.queryFn({ 
        pageParam, 
        signal: optimizedSignal 
      });

      return result;
    },
    initialPageParam: options.initialPageParam,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: options.enabled,
    staleTime: options.staleTime ?? 30000, // 30 seconds default
    cacheTime: options.cacheTime ?? 5 * 60 * 1000, // 5 minutes default
    refetchOnMount: options.refetchOnMount ?? false,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
    refetchOnReconnect: options.refetchOnReconnect ?? true,
    retry: (failureCount, error) => {
      // Don't retry on abort errors
      if (error.name === 'AbortError') return false;
      // Max 3 retries
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // Optimized data processing
  const processedData = useMemo(() => {
    if (!query.data?.pages) return { events: [], totalCount: 0 };

    const allEvents = query.data.pages.flatMap(page => page.events);
    
    // Deduplicate events by ID
    const uniqueEvents = allEvents.filter(
      (event, index, self) => index === self.findIndex(e => e.id === event.id)
    );

    // Sort by created_at (newest first)
    const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);

    return {
      events: sortedEvents,
      totalCount: sortedEvents.length,
      totalPages: query.data.pages.length,
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
    };
  }, [query.data?.pages]);

  // Optimized prefetching
  const prefetchNextPage = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetching) {
      // Debounce prefetching to avoid excessive requests
      clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = setTimeout(() => {
        query.prefetchNextPage();
      }, 2000); // 2 second delay
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.isFetching]);

  // Optimized refresh
  const refresh = useCallback(() => {
    // Remove all pages and refetch first page
    queryClient.removeQueries({ queryKey: options.queryKey });
    query.refetch();
  }, [queryClient, options.queryKey, query]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearTimeout(prefetchTimeoutRef.current);
    };
  }, []);

  return {
    ...query,
    ...processedData,
    refresh,
    prefetchNextPage,
  };
}

// Hook for preloading content based on user behavior
export function useContentPreloader() {
  const queryClient = useQueryClient();

  const preloadContent = useCallback(async (
    queryKey: string[],
    queryFn: () => Promise<{ events: NostrEvent[] }>
  ) => {
    try {
      await queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime: 60000, // 1 minute
        cacheTime: 10 * 60 * 1000, // 10 minutes
      });
    } catch (error) {
      // Silent fail for preloading
      console.debug('Content preloading failed:', error);
    }
  }, [queryClient]);

  return { preloadContent };
}

// Hook for optimizing content visibility tracking
export function useContentVisibility(
  contentIds: string[],
  options: {
    rootMargin?: string;
    threshold?: number;
    onVisible?: (contentId: string) => void;
  } = {}
) {
  const {
    rootMargin = '100px',
    threshold = 0.1,
    onVisible,
  } = options;

  const visibleContentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const contentId = entry.target.getAttribute('data-content-id');
          
          if (!contentId) return;

          if (entry.isIntersecting) {
            visibleContentRef.current.add(contentId);
            onVisible?.(contentId);
          } else {
            visibleContentRef.current.delete(contentId);
          }
        });
      },
      { rootMargin, threshold }
    );

    // Observe all content elements
    contentIds.forEach((contentId) => {
      const element = document.querySelector(`[data-content-id="${contentId}"]`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [contentIds, rootMargin, threshold, onVisible]);

  return {
    visibleContent: Array.from(visibleContentRef.current),
  };
}