import { memo, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { useSkeletonCount, useVisibleItemTracker } from '@/hooks/useOptimizedFeedLoader';
import { useOptimizedImagePosts, useOptimizedFollowingImagePosts } from '@/hooks/useOptimizedImagePosts';
import { useFollowing } from '@/hooks/useFollowing';
import { ImagePost } from './ImagePost';
import { ImagePostSkeleton } from './ImagePostSkeleton';
import { Button } from './ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';

interface OptimizedImageFeedProps {
  feedType: 'global' | 'following';
  hashtag?: string;
  location?: string;
  onHashtagClick?: (hashtag: string) => void;
  onLocationClick?: (location: string) => void;
}

// Memoized skeleton component to prevent unnecessary re-renders
const MemoizedImagePostSkeleton = memo(({ index }: { index: number }) => (
  <ImagePostSkeleton key={`skeleton-${index}`} />
));

// Memoized image post component
const MemoizedImagePost = memo(({ event, onHashtagClick, onLocationClick }: {
  event: any;
  onHashtagClick?: (hashtag: string) => void;
  onLocationClick?: (location: string) => void;
}) => (
  <ImagePost
    key={event.id}
    event={event}
    onHashtagClick={onHashtagClick}
    onLocationClick={onLocationClick}
  />
));

export function OptimizedImageFeed({
  feedType,
  hashtag,
  location,
  onHashtagClick,
  onLocationClick,
}: OptimizedImageFeedProps) {
  const { data: following } = useFollowing();
  const followingPubkeys = following?.map(f => f.pubkey) || [];

  // Use optimized hooks based on feed type
  const globalPosts = useOptimizedImagePosts(hashtag, location);
  const followingPosts = useOptimizedFollowingImagePosts(followingPubkeys);

  // Select the appropriate query based on feed type
  const query = feedType === 'global' ? globalPosts : followingPosts;

  // Get skeleton count for loading state
  const { skeletonCount } = useSkeletonCount(
    query.isLoading || query.isFetching,
    'images',
    query.config
  );

  // Setup prefetching when user approaches bottom
  const handlePrefetchNeeded = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.prefetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.prefetchNextPage]);

  // Track visible items for prefetching
  const { visibleItems } = useVisibleItemTracker(
    query.events.length,
    handlePrefetchNeeded,
    query.config
  );

  // Setup intersection observer for infinite scrolling
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: '200px', // Start loading 200px before visible
  });

  // Load more when scrolling near bottom
  const handleLoadMore = useCallback(() => {
    if (inView && query.hasNextPage && !query.isFetchingNextPage && !query.isFetching) {
      query.fetchNextPage();
    }
  }, [inView, query.hasNextPage, query.isFetchingNextPage, query.isFetching, query.fetchNextPage]);

  // Refresh feed
  const handleRefresh = useCallback(() => {
    query.refresh();
  }, [query.refresh]);

  // Combine actual events and skeletons for smooth loading
  const displayItems = useCallback(() => {
    const items = [];

    // Add actual events
    query.events.forEach((event, index) => {
      items.push({
        type: 'event' as const,
        data: event,
        index,
      });
    });

    // Add skeleton items at the end while loading
    if ((query.isLoading || query.isFetching) && skeletonCount > 0) {
      for (let i = 0; i < skeletonCount; i++) {
        items.push({
          type: 'skeleton' as const,
          data: null,
          index: query.events.length + i,
        });
      }
    }

    return items;
  }, [query.events, query.isLoading, query.isFetching, skeletonCount]);

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {feedType === 'global' ? 'Global Feed' : 'Following Feed'}
          {hashtag && (
            <span className="ml-2 text-sm text-muted-foreground">
              #{hashtag}
            </span>
          )}
          {location && (
            <span className="ml-2 text-sm text-muted-foreground">
              📍 {location}
            </span>
          )}
        </h2>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={query.isLoading || query.isFetching}
          className="flex items-center space-x-2"
        >
          {query.isLoading || query.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span>Refresh</span>
        </Button>
      </div>

      {/* Feed content */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayItems().map((item, index) => {
          const isVisible = visibleItems.includes(index);
          
          if (item.type === 'event') {
            return (
              <div
                key={item.data.id}
                data-index={index}
                className="transition-all duration-300"
                style={{
                  opacity: isVisible ? 1 : 0.8,
                  transform: isVisible ? 'scale(1)' : 'scale(0.98)',
                }}
              >
                <MemoizedImagePost
                  event={item.data}
                  onHashtagClick={onHashtagClick}
                  onLocationClick={onLocationClick}
                />
              </div>
            );
          } else {
            return (
              <div
                key={`skeleton-${item.index}`}
                data-index={index}
                className="transition-all duration-300"
                style={{
                  opacity: isVisible ? 1 : 0.6,
                }}
              >
                <MemoizedImagePostSkeleton index={item.index} />
              </div>
            );
          }
        })}
      </div>

      {/* Loading indicator at bottom */}
      {(query.isFetchingNextPage || query.isLoading) && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {query.events.length === 0 && !query.isLoading && !query.isFetching && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            No images found
            {hashtag && ` for #${hashtag}`}
            {location && ` in ${location}`}
          </div>
        </div>
      )}

      {/* Load more trigger */}
      {query.hasNextPage && (
        <div ref={loadMoreRef} className="h-4" />
      )}
    </div>
  );
}

// Memoize the entire component to prevent unnecessary re-renders
export default memo(OptimizedImageFeed);