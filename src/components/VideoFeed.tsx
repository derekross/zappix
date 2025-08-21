import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { VideoPost } from './VideoPost';
import { VideoPostSkeleton } from './VideoPostSkeleton';
import { CommentModal } from './CommentModal';
import { useAllVideoPosts, useFollowingAllVideoPosts } from '@/hooks/useAllVideoPosts';
import { useFollowing } from '@/hooks/useFollowing';
import { useCurrentUser } from '@/hooks/useCurrentUser';
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
  const { user } = useCurrentUser();
  const following = useFollowing();
  const followingPubkeys = useMemo(() => following.data || [], [following.data]);
  const isMobile = useIsMobile();

  // Use the video queries for vertical videos only
  const globalAllQuery = useAllVideoPosts(hashtag, location, 'vertical');
  const followingAllQuery = useFollowingAllVideoPosts(followingPubkeys, 'vertical');

  // Choose the appropriate query based on feed type
  const query = feedType === 'following' ? followingAllQuery : globalAllQuery;

  // Debug logging for following feed
  useEffect(() => {
    if (feedType === 'following') {
      console.log('🔍 Following feed debug:', {
        userPubkey: user?.pubkey,
        followingPubkeys: followingPubkeys.length,
        followingPubkeysSample: followingPubkeys.slice(0, 3),
        followingQuery: {
          isLoading: followingAllQuery.isLoading,
          isError: followingAllQuery.isError,
          error: followingAllQuery.error,
          data: followingAllQuery.data,
          hasNextPage: followingAllQuery.hasNextPage,
          isFetching: followingAllQuery.isFetching,
          isFetchingNextPage: followingAllQuery.isFetchingNextPage,
          hasPreviousPage: followingAllQuery.hasPreviousPage,
        },
        following: {
          isLoading: following.isLoading,
          isError: following.isError,
          error: following.error,
          data: following.data,
        }
      });
    }
  }, [feedType, followingPubkeys, followingAllQuery, following, user]);

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '200px', // Start loading earlier
  });

  // Load more when scrolling near bottom
  useEffect(() => {
    if (inView && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [inView, query]);

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
  const videoRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Comment modal state
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<NostrEvent | null>(null);

  // Calculate container height based on layout
  const getContainerHeight = useCallback(() => {
    if (isMobile) {
      // Mobile: subtract header (56px) and bottom nav (80px)
      return window.innerHeight - 56 - 80;
    } else {
      // Desktop: full height minus some padding/header space
      return window.innerHeight - 120; // Account for desktop layout padding
    }
  }, [isMobile]);

  // Handle scroll with intersection observer for better performance
  useEffect(() => {
    if (!containerRef.current || uniqueEvents.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLDivElement;
            const index = videoRefs.current.indexOf(element);
            if (index !== -1 && index !== activeIndex) {
              setActiveIndex(index);
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.7, // 70% of the video should be visible
      }
    );

    // Observe all video containers
    videoRefs.current.forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [uniqueEvents, activeIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!uniqueEvents || uniqueEvents.length === 0) return;

      if (e.key === 'ArrowDown' && activeIndex < uniqueEvents.length - 1) {
        e.preventDefault();
        setActiveIndex(prev => prev + 1);
        // Scroll to next video
        videoRefs.current[activeIndex + 1]?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      } else if (e.key === 'ArrowUp' && activeIndex > 0) {
        e.preventDefault();
        setActiveIndex(prev => prev - 1);
        // Scroll to previous video
        videoRefs.current[activeIndex - 1]?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uniqueEvents, activeIndex]);

  // Touch handling for mobile swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd || uniqueEvents.length === 0) return;

    const distance = touchStart - touchEnd;
    const isSwipeUp = distance > 50;
    const isSwipeDown = distance < -50;

    if (isSwipeUp && activeIndex < uniqueEvents.length - 1) {
      setActiveIndex(prev => prev + 1);
      videoRefs.current[activeIndex + 1]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    } else if (isSwipeDown && activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
      videoRefs.current[activeIndex - 1]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [touchStart, touchEnd, activeIndex, uniqueEvents.length]);

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
      style={{ height: `${getContainerHeight()}px` }}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Video Container */}
      <div className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide">
        {uniqueEvents.map((event, index) => (
          <div
            key={event.id}
            ref={(el) => {
              videoRefs.current[index] = el;
            }}
            className="h-full snap-start"
          >
            <VideoPost
              event={event}
              isActive={index === activeIndex}
              isMuted={isMuted}
              onMuteToggle={() => setIsMuted(!isMuted)}
              onHashtagClick={onHashtagClick}
              onLocationClick={onLocationClick}
              onCommentClick={handleCommentClick}
            />
          </div>
        ))}
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
                setActiveIndex(prev => prev - 1);
                videoRefs.current[activeIndex - 1]?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start'
                });
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
                setActiveIndex(prev => prev + 1);
                videoRefs.current[activeIndex + 1]?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start'
                });
              }
            }}
            disabled={activeIndex === uniqueEvents.length - 1}
          >
            <ChevronDown className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Load more trigger */}
      {query.hasNextPage && activeIndex > uniqueEvents.length - 5 && (
        <div ref={ref} className="flex justify-center py-8 absolute bottom-0 left-0 right-0">
          {query.isFetchingNextPage ? (
            <div className="flex items-center space-x-2 text-white">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span className="text-sm">Loading more videos...</span>
            </div>
          ) : (
            <div className="h-1 w-1" /> // Invisible trigger
          )}
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