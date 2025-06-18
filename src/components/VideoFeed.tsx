import { useEffect, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import { VideoPost } from "./VideoPost";
import { VideoPostSkeleton } from "./VideoPostSkeleton";
import { useAllVideoPosts, useFollowingAllVideoPosts } from "@/hooks/useAllVideoPosts";
import { useFollowing } from "@/hooks/useFollowing";
import { Card, CardContent } from "@/components/ui/card";

interface VideoFeedProps {
  feedType: "global" | "following";
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

  // Use the video queries for vertical videos only (TikTok-style)
  const globalAllQuery = useAllVideoPosts(hashtag, location, 'vertical');
  const followingAllQuery = useFollowingAllVideoPosts(followingPubkeys, 'vertical');

  // Choose the appropriate query based on feed type
  const query = feedType === "following" ? followingAllQuery : globalAllQuery;

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
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
    if (feedType === "following" && followingPubkeys.length === 0) {
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
                {feedType === "following"
                  ? "No flix from people you follow yet. Flix will appear as they publish to the network."
                  : hashtag
                  ? `No flix found for #${hashtag}. Flix will appear as users publish to the network.`
                  : location
                  ? `No flix found for ${location}. Flix will appear as users publish to the network.`
                  : "No flix found. Flix will appear as users publish to the network."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Video Posts */}
      {uniqueEvents.map((event) => (
        <VideoPost
          key={event.id}
          event={event}
          onHashtagClick={onHashtagClick}
          onLocationClick={onLocationClick}
        />
      ))}

      {/* Loading indicator for pagination */}
      {query.hasNextPage && (
        <div ref={ref} className="space-y-6">
          {query.isFetchingNextPage &&
            Array.from({ length: 2 }).map((_, i) => (
              <VideoPostSkeleton key={`loading-${i}`} />
            ))}
        </div>
      )}

      {/* End of feed indicator */}
      {!query.hasNextPage && uniqueEvents.length > 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">
            You've reached the end of the feed
          </p>
        </div>
      )}
    </div>
  );
}