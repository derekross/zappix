import { useImagePosts, useFollowingImagePosts } from "@/hooks/useImagePosts";
import { useFollowing } from "@/hooks/useFollowing";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ImagePost } from "./ImagePost";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useEffect } from "react";

interface ImageFeedProps {
  feedType: "global" | "following";
  hashtag?: string;
  location?: string;
  onHashtagClick?: (hashtag: string) => void;
  onLocationClick?: (location: string) => void;
}

function ImagePostSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-center space-x-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
      <Skeleton className="aspect-square w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex space-x-4 pt-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </Card>
  );
}

export function ImageFeed({
  feedType,
  hashtag,
  location,
  onHashtagClick,
  onLocationClick,
}: ImageFeedProps) {
  const { user } = useCurrentUser();
  const following = useFollowing();
  const queryClient = useQueryClient();

  const globalPosts = useImagePosts(hashtag, location);
  const followingPosts = useFollowingImagePosts(following.data || []);

  const posts = feedType === "following" ? followingPosts : globalPosts;

  // Intersection observer for infinite scrolling
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: "100px", // Start loading 100px before the element comes into view
  });

  // Load more posts when the load more element comes into view
  useEffect(() => {
    if (inView && posts.hasNextPage && !posts.isFetchingNextPage) {
      posts.fetchNextPage();
    }
  }, [inView, posts]);

  const handleRefresh = () => {
    if (feedType === "following") {
      // Refresh both following list and following posts
      queryClient.invalidateQueries({ queryKey: ["following"] });
      queryClient.invalidateQueries({ queryKey: ["following-image-posts"] });
    } else {
      // Refresh global posts
      queryClient.invalidateQueries({ queryKey: ["image-posts"] });
    }
  };

  if (posts.isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <ImagePostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (posts.error) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <p className="text-muted-foreground">
              Failed to load posts. Please try again.
            </p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Flatten all pages into a single array of posts
  const allPosts = posts.data?.pages?.flatMap((page) => page.events) || [];

  if (!posts.data || allPosts.length === 0) {
    // For following feed, check if we're still loading the following list
    if (feedType === "following" && following.isLoading) {
      return (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <ImagePostSkeleton key={i} />
          ))}
        </div>
      );
    }

    return (
      <Card className="border-dashed">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <p className="text-muted-foreground">
              {feedType === "following" &&
              (!user || (following.data && following.data.length === 0))
                ? "Follow some users to see their posts here"
                : feedType === "following" && following.error
                ? "Failed to load your following list. Please try refreshing."
                : feedType === "following" &&
                  following.data &&
                  following.data.length > 0
                ? "No recent posts from people you follow. They may be publishing to relays not in your network."
                : hashtag
                ? `No posts found with #${hashtag}`
                : "No posts found. Content will appear as users publish to the network."}
            </p>
            {feedType === "following" &&
              (following.error ||
                (following.data && following.data.length > 0)) && (
                <Button onClick={handleRefresh} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Feed
                </Button>
              )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {allPosts.map((post) => (
        <ImagePost
          key={post.id}
          event={post}
          onHashtagClick={onHashtagClick}
          onLocationClick={onLocationClick}
        />
      ))}

      {/* Load more trigger element */}
      {posts.hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {posts.isFetchingNextPage ? (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading more posts...</span>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => posts.fetchNextPage()}
              disabled={!posts.hasNextPage}
            >
              Load More
            </Button>
          )}
        </div>
      )}

      {/* End of feed indicator */}
      {!posts.hasNextPage && allPosts.length > 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">
            You've reached the end of the feed
          </p>
        </div>
      )}
    </div>
  );
}
