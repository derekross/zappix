import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { useVirtualizer } from '@tanstack/react-virtual';
import { VideoPost } from './VideoPost';
import { VideoPostSkeleton } from './VideoPostSkeleton';
import { CommentModal } from './CommentModal';
import { useAllVideoPosts, useFollowingAllVideoPosts } from '@/hooks/useAllVideoPosts';
import { useFollowing } from '@/hooks/useFollowing';
import { Card, CardContent } from '@/components/ui/card';
import { NostrEvent } from '@nostrify/nostrify';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';

interface VideoFeedProps {
  feedType: 'global' | 'following';
  hashtag?: string;
  location?: string;
  onHashtagClick?: (hashtag: string) => void;
  onLocationClick?: (location: string) => void;
}

export function VideoFeed({
  feedType,
  hashtag,
  location,
  onHashtagClick,
  onLocationClick,
}: VideoFeedProps) {
  const following = useFollowing();
  const followingPubkeys = useMemo(() => following.data || [], [following.data]);
  const isMobile = useIsMobile();

  // Use the video queries for vertical videos only
  const globalAllQuery = useAllVideoPosts(hashtag, location, 'vertical');
  const followingAllQuery = useFollowingAllVideoPosts(followingPubkeys, 'vertical');

  // Choose the appropriate query based on feed type
  const query = feedType === 'following' ? followingAllQuery : globalAllQuery;

  const { ref: _ref, inView } = useInView({
    threshold: 0,
    rootMargin: '200px', // Start loading earlier
  });

  // Load more when scrolling near bottom
  useEffect(() => {
    if (inView && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [inView, query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  // Get all events from all pages and deduplicate
  const uniqueEvents = useMemo(() => {
    const allEvents = query.data?.pages?.flatMap((page) => page.events) || [];

    // Deduplicate events by ID to prevent duplicate keys
    return allEvents.filter(
      (event, index, self) => index === self.findIndex((e) => e.id === event.id)
    );
  }, [query.data?.pages]);

  // TikTok-style state
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Comment modal state
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<NostrEvent | null>(null);

  // Calculate container height based on layout
  const containerHeight = useMemo(() => {
    if (isMobile) {
      return window.innerHeight - 56 - 80;
    } else {
      return window.innerHeight - 120;
    }
  }, [isMobile]);

  // Virtualization for video list
  const virtualizer = useVirtualizer({
    count: uniqueEvents.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => containerHeight,
    overscan: 1, // Only render 1 item above/below for videos
  });

  // Update active index based on scroll position
  useEffect(() => {
    const scrollElement = containerRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const scrollTop = scrollElement.scrollTop;
      const newIndex = Math.round(scrollTop / containerHeight);
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < uniqueEvents.length) {
        setActiveIndex(newIndex);
      }
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [activeIndex, containerHeight, uniqueEvents.length]);

  // Fetch more when near the end
  useEffect(() => {
    if (activeIndex >= uniqueEvents.length - 3 && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [activeIndex, uniqueEvents.length, query]);

  // Scroll to specific index
  const scrollToIndex = useCallback((index: number) => {
    if (containerRef.current && index >= 0 && index < uniqueEvents.length) {
      containerRef.current.scrollTo({
        top: index * containerHeight,
        behavior: 'smooth',
      });
    }
  }, [containerHeight, uniqueEvents.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!uniqueEvents || uniqueEvents.length === 0) return;

      if (e.key === 'ArrowDown' && activeIndex < uniqueEvents.length - 1) {
        e.preventDefault();
        const newIndex = activeIndex + 1;
        setActiveIndex(newIndex);
        scrollToIndex(newIndex);
      } else if (e.key === 'ArrowUp' && activeIndex > 0) {
        e.preventDefault();
        const newIndex = activeIndex - 1;
        setActiveIndex(newIndex);
        scrollToIndex(newIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uniqueEvents, activeIndex, scrollToIndex]);


  // Show loading skeleton for initial load
  if (query.isLoading && !query.data) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <VideoPostSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Show error state only if we have no data
  if (query.isError && !query.data) {
    return (
      <div className="col-span-full">
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <p className="text-muted-foreground">
                Failed to load flix. Please try again.
              </p>
              <button
                onClick={() => query.refetch()}
                className="text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show empty state
  if (uniqueEvents.length === 0) {
    // Special case for following feed when user follows no one
    if (feedType === 'following' && followingPubkeys.length === 0) {
      return (
        <div className="col-span-full">
          <Card className="border-dashed">
            <CardContent className="py-12 px-8 text-center">
              <div className="max-w-sm mx-auto space-y-6">
                <p className="text-muted-foreground">
                  You're not following anyone yet. Follow some users to see their flix here.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="col-span-full">
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <p className="text-muted-foreground">
                {feedType === 'following'
                  ? 'No flix from people you follow yet. Flix will appear as they publish to the network.'
                  : hashtag
                  ? `No flix found for #${hashtag}. Flix will appear as users publish to the network.`
                  : location
                  ? `No flix found for ${location}. Flix will appear as users publish to the network.`
                  : 'No flix found. Flix will appear as users publish to the network.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle comment modal open
  const handleCommentClick = (event: NostrEvent) => {
    setSelectedEvent(event);
    setCommentModalOpen(true);
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: `${containerHeight}px` }}
    >
      {/* Virtualized Video Container - CSS snap handles swipe navigation */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const event = uniqueEvents[virtualItem.index];
            if (!event) return null;

            return (
              <div
                key={event.id}
                data-index={virtualItem.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${containerHeight}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="snap-start"
              >
                <VideoPost
                  event={event}
                  isActive={virtualItem.index === activeIndex}
                  isMuted={isMuted}
                  onMuteToggle={() => setIsMuted(!isMuted)}
                  onHashtagClick={onHashtagClick}
                  onLocationClick={onLocationClick}
                  onCommentClick={handleCommentClick}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Arrows - Desktop only */}
      {uniqueEvents && uniqueEvents.length > 1 && (
        <div className="hidden md:flex md:flex-col fixed left-6 top-1/2 transform -translate-y-1/2 z-50 gap-4">
          <Button
            variant="secondary"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white border-0 rounded-full w-12 h-12 disabled:opacity-30"
            onClick={() => {
              if (activeIndex > 0) {
                const newIndex = activeIndex - 1;
                setActiveIndex(newIndex);
                scrollToIndex(newIndex);
              }
            }}
            disabled={activeIndex === 0}
          >
            <ChevronUp className="h-6 w-6" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white border-0 rounded-full w-12 h-12 disabled:opacity-30"
            onClick={() => {
              if (activeIndex < uniqueEvents.length - 1) {
                const newIndex = activeIndex + 1;
                setActiveIndex(newIndex);
                scrollToIndex(newIndex);
              }
            }}
            disabled={activeIndex === uniqueEvents.length - 1}
          >
            <ChevronDown className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Loading indicator */}
      {query.isFetchingNextPage && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center space-x-2 text-white bg-black/50 px-3 py-1 rounded-full">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      <CommentModal
        open={commentModalOpen}
        onOpenChange={setCommentModalOpen}
        event={selectedEvent}
      />
    </div>
  );
}