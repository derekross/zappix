import { useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { VideoPost } from './VideoPost';
import { VideoPostSkeleton } from './VideoPostSkeleton';
import { CommentModal } from './CommentModal';
import { useAllVideoPosts, useFollowingAllVideoPosts } from '@/hooks/useAllVideoPosts';
import { useFollowing } from '@/hooks/useFollowing';
import { Card, CardContent } from '@/components/ui/card';
import { NostrEvent } from '@nostrify/nostrify';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useMemo } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';

interface VideoFeedSimpleProps {
  feedType: 'global' | 'following';
  hashtag?: string;
  location?: string;
  onHashtagClick?: (hashtag: string) => void;
  onLocationClick?: (location: string) => void;
}

export function VideoFeedSimple({
  feedType,
  hashtag,
  location,
  onHashtagClick,
  onLocationClick,
}: VideoFeedSimpleProps) {
  const following = useFollowing();
  const followingPubkeys = useMemo(() => following.data || [], [following.data]);
  const isMobile = useIsMobile();

  // Use the video queries for vertical videos only
  const globalAllQuery = useAllVideoPosts(hashtag, location, 'vertical');
  const followingAllQuery = useFollowingAllVideoPosts(followingPubkeys, 'vertical');

  // Choose the appropriate query based on feed type
  const query = feedType === 'following' ? followingAllQuery : globalAllQuery;

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Comment modal state
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<NostrEvent | null>(null);
  
  // Calculate container height based on layout
  const getContainerHeight = () => {
    if (isMobile) {
      // Mobile: subtract header (56px) and bottom nav (80px)
      return window.innerHeight - 56 - 80;
    } else {
      // Desktop: full height minus some padding/header space
      return window.innerHeight - 120; // Account for desktop layout padding
    }
  };

  // Scroll handling
  useEffect(() => {
    const handleScroll = (e: WheelEvent) => {
      e.preventDefault();
      
      if (!uniqueEvents || uniqueEvents.length === 0) return;
      
      if (e.deltaY > 0 && currentIndex < uniqueEvents.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (e.deltaY < 0 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!uniqueEvents || uniqueEvents.length === 0) return;
      
      if (e.key === 'ArrowDown' && currentIndex < uniqueEvents.length - 1) {
        e.preventDefault();
        setCurrentIndex(prev => prev + 1);
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault();
        setCurrentIndex(prev => prev - 1);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleScroll, { passive: false });
    }
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleScroll);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [uniqueEvents, currentIndex]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isSwipeUp = distance > 50;
    const isSwipeDown = distance < -50;

    if (!uniqueEvents || uniqueEvents.length === 0) return;

    if (isSwipeUp && currentIndex < uniqueEvents.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (isSwipeDown && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

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
      <div>
        <div 
          className="transition-transform duration-500 ease-in-out"
          style={{ transform: `translateY(-${currentIndex * getContainerHeight()}px)` }}
        >
          {uniqueEvents.map((event, index) => (
            <VideoPost
              key={event.id}
              event={event}
              isActive={index === currentIndex}
              isMuted={isMuted}
              onMuteToggle={() => setIsMuted(!isMuted)}
              onHashtagClick={onHashtagClick}
              onLocationClick={onLocationClick}
              onCommentClick={handleCommentClick}
            />
          ))}
        </div>
      </div>

      {/* Navigation Arrows - Desktop only */}
      {uniqueEvents && uniqueEvents.length > 1 && (
        <div className="hidden md:flex md:flex-col fixed left-6 top-1/2 transform -translate-y-1/2 z-50 gap-4">
          <Button
            variant="secondary"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white border-0 rounded-full w-12 h-12 disabled:opacity-30"
            onClick={() => currentIndex > 0 && setCurrentIndex(prev => prev - 1)}
            disabled={currentIndex === 0}
          >
            <ChevronUp className="h-6 w-6" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white border-0 rounded-full w-12 h-12 disabled:opacity-30"
            onClick={() => currentIndex < uniqueEvents.length - 1 && setCurrentIndex(prev => prev + 1)}
            disabled={currentIndex === uniqueEvents.length - 1}
          >
            <ChevronDown className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Load more trigger - positioned off screen but still functional */}
      {query.hasNextPage && currentIndex > uniqueEvents.length - 5 && (
        <div ref={ref} className="absolute -bottom-10 left-0 w-1 h-1" />
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