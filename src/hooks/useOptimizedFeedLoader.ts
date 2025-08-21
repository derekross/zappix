import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useEffect } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';

interface OptimizedFeedConfig {
  // Initial page sizes (much smaller for faster loading)
  initialImageLimit: number;
  initialVideoLimit: number;
  
  // Subsequent page sizes (can be larger)
  subsequentImageLimit: number;
  subsequentVideoLimit: number;
  
  // Prefetch threshold
  prefetchThreshold: number;
  
  // Enable skeleton loading
  enableSkeletons: boolean;
}

interface UseOptimizedFeedOptions {
  feedType: 'images' | 'videos';
  queryKey: string[];
  queryFn: (params: { 
    limit: number; 
    pageParam?: number; 
    signal: AbortSignal;
    hashtag?: string;
    location?: string;
    followingPubkeys?: string[];
  }) => Promise<{
    events: NostrEvent[];
    nextCursor?: number;
  }>;
  hashtag?: string;
  location?: string;
  followingPubkeys?: string[];
  enabled?: boolean;
}

// Default optimized configuration
const DEFAULT_CONFIG: OptimizedFeedConfig = {
  initialImageLimit: 8,    // Reduced from 20 to 8 (60% reduction)
  initialVideoLimit: 6,    // Reduced from 20 to 6 (70% reduction)
  subsequentImageLimit: 12, // Reduced from 20 to 12 (40% reduction)
  subsequentVideoLimit: 10, // Reduced from 15 to 10 (33% reduction)
  prefetchThreshold: 3,    // Prefetch when 3 items from bottom
  enableSkeletons: true,  // Show skeletons while loading
};

export function useOptimizedFeedLoader(
  options: UseOptimizedFeedOptions,
  config: Partial<OptimizedFeedConfig> = {}
) {
  const queryClient = useQueryClient();
  const prefetchTimeoutRef = useRef<NodeJS.Timeout>();
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Determine initial and subsequent limits based on feed type
  const getLimits = useCallback((isInitialPage = true) => {
    if (options.feedType === 'images') {
      return {
        limit: isInitialPage ? finalConfig.initialImageLimit : finalConfig.subsequentImageLimit,
      };
    } else {
      return {
        limit: isInitialPage ? finalConfig.initialVideoLimit : finalConfig.subsequentVideoLimit,
      };
    }
  }, [options.feedType, finalConfig]);

  // Optimized infinite query
  const query = useInfiniteQuery({
    queryKey: [...options.queryKey, 'optimized', finalConfig],
    queryFn: async ({ pageParam, signal }) => {
      const isInitialPage = pageParam === undefined;
      const { limit } = getLimits(isInitialPage);

      // Create optimized signal with timeout
      const optimizedSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(8000), // 8 second timeout (reduced from 10s)
      ]);

      const result = await options.queryFn({
        limit,
        pageParam,
        signal: optimizedSignal,
        hashtag: options.hashtag,
        location: options.location,
        followingPubkeys: options.followingPubkeys,
      });

      return result;
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: options.enabled,
    staleTime: 30000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      if (error.name === 'AbortError') return false;
      return failureCount < 2; // Max 2 retries
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });

  // Optimized data processing
  const processedData = useCallback(() => {
    if (!query.data?.pages) return { events: [], totalCount: 0, isLoading: true };

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
      isLoading: query.isLoading || query.isFetching,
    };
  }, [query.data?.pages, query.isLoading, query.isFetching, query.hasNextPage, query.isFetchingNextPage]);

  // Optimized prefetching with debouncing
  const prefetchNextPage = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetching) {
      clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = setTimeout(() => {
        query.prefetchNextPage();
      }, 1500); // 1.5 second debounce (reduced from 2s)
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
    ...processedData(),
    refresh,
    prefetchNextPage,
    config: finalConfig,
  };
}

// Hook for calculating skeleton items
export function useSkeletonCount(
  isLoading: boolean,
  feedType: 'images' | 'videos',
  config: OptimizedFeedConfig = DEFAULT_CONFIG
) {
  const skeletonCount = useCallback(() => {
    if (!isLoading || !config.enableSkeletons) return 0;
    
    // Show skeleton count based on initial limits
    const initialLimit = feedType === 'images' 
      ? config.initialImageLimit 
      : config.initialVideoLimit;
    
    // Add 2 extra skeletons to make loading feel smoother
    return initialLimit + 2;
  }, [isLoading, feedType, config]);

  return { skeletonCount: skeletonCount() };
}

// Hook for tracking visible items and prefetching
export function useVisibleItemTracker(
  itemCount: number,
  onPrefetchNeeded: () => void,
  config: OptimizedFeedConfig = DEFAULT_CONFIG
) {
  const observerRef = useRef<IntersectionObserver>();
  const visibleItemsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (itemCount === 0) return;

    // Calculate prefetch threshold index
    const prefetchIndex = Math.max(0, itemCount - config.prefetchThreshold);

    // Create intersection observer for prefetch threshold items
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = parseInt(entry.target.getAttribute('data-index') || '0');
          
          if (entry.isIntersecting) {
            visibleItemsRef.current.add(index);
            
            // Check if we've reached prefetch threshold
            if (index >= prefetchIndex) {
              onPrefetchNeeded();
            }
          } else {
            visibleItemsRef.current.delete(index);
          }
        });
      },
      { 
        rootMargin: '100px', // Start observing 100px before visible
        threshold: 0.1, // Trigger when 10% visible
      }
    );

    // Observe items near prefetch threshold
    for (let i = Math.max(0, prefetchIndex - 2); i < itemCount; i++) {
      const element = document.querySelector(`[data-index="${i}"]`);
      if (element) {
        observerRef.current.observe(element);
      }
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [itemCount, config.prefetchThreshold, onPrefetchNeeded]);

  return {
    visibleItems: Array.from(visibleItemsRef.current),
  };
}