// src/pages/HashtagFeedPage.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useNdk } from "../contexts/NdkContext";
import { NDKEvent, NDKFilter, NDKKind, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk";
import { ImagePost } from "../components/ImagePost";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import toast from "react-hot-toast";

// Reverted to include Kind 1, 20 (repost), and 30315 (potential image kind)
const FEED_KINDS = [NDKKind.Text, NDKKind.Repost, 30315 as NDKKind];
const POSTS_PER_PAGE = 10;

export const HashtagFeedPage: React.FC = () => {
  const { ndk } = useNdk();
  const { hashtag } = useParams<{ hashtag: string }>();
  const [posts, setPosts] = useState<NDKEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReachingEnd, setIsReachingEnd] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<number | undefined>(undefined);
  const processingRef = useRef(false);

  const cleanHashtag = hashtag?.startsWith("#") ? hashtag.substring(1) : hashtag;

  const fetchHashtagFeed = useCallback(
    async (until?: number) => {
      if (processingRef.current || !ndk || !cleanHashtag || isLoading || isReachingEnd) {
        return;
      }
      processingRef.current = true;
      console.log(
        `Fetching feed for hashtag: #${cleanHashtag} (Kinds: ${FEED_KINDS.join(",")}), until: ${until ? new Date(until * 1000).toISOString() : "Now"}`,
      );
      setIsLoading(true);

      const filter: NDKFilter = {
        kinds: FEED_KINDS, // Fetch multiple kinds
        "#t": [cleanHashtag],
        limit: POSTS_PER_PAGE,
      };
      if (until) {
        filter.until = until;
      }

      try {
        const fetchedEvents = await ndk.fetchEvents(filter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        const sortedEvents = Array.from(fetchedEvents).sort(
          (a, b) => b.created_at! - a.created_at!,
        );
        console.log(`Fetched ${sortedEvents.length} events for #${cleanHashtag}.`);

        if (sortedEvents.length === 0 || sortedEvents.length < POSTS_PER_PAGE) {
          setIsReachingEnd(true);
        }
        if (sortedEvents.length > 0) {
          setLastEventTime(sortedEvents[sortedEvents.length - 1].created_at! - 1);
        }
        setPosts((prevPosts) => {
          const existingIds = new Set(prevPosts.map((p) => p.id));
          const newUniquePosts = sortedEvents.filter((p) => !existingIds.has(p.id));
          return [...prevPosts, ...newUniquePosts];
        });
      } catch (error) {
        toast.error(`Failed to fetch posts for #${cleanHashtag}.`);
      } finally {
        setIsLoading(false);
        processingRef.current = false;
      }
    },
    [ndk, isLoading, isReachingEnd, cleanHashtag],
  );

  useEffect(() => {
    console.log(`Hashtag changed to: ${cleanHashtag}, resetting feed.`);
    setPosts([]);
    setLastEventTime(undefined);
    setIsReachingEnd(false);
    processingRef.current = false;
    if (ndk && cleanHashtag) {
      fetchHashtagFeed();
    }
    return () => {
      processingRef.current = true;
    };
  }, [ndk, cleanHashtag]); // Rerun only if NDK or hashtag changes

  const loadMore = () => {
    fetchHashtagFeed(lastEventTime);
  };

  if (!cleanHashtag) {
    return <Alert severity="error">Invalid hashtag provided.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ wordBreak: "break-all" }}>
        #{cleanHashtag}
      </Typography>
      {posts.length === 0 && isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      )}
      {posts.length === 0 && !isLoading && isReachingEnd && (
        // Reverted empty text
        <Typography sx={{ textAlign: "center", p: 3 }}>
          No posts found for #{cleanHashtag}.
        </Typography>
      )}
      <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 3 } }}>
        {posts.map((event) => (
          <ImagePost key={event.id} event={event} />
        ))}
      </Box>
      {posts.length > 0 && !isLoading && !isReachingEnd && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <Button variant="contained" onClick={loadMore} disabled={isLoading}>
            Load More
          </Button>
        </Box>
      )}
      {isLoading && posts.length > 0 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {isReachingEnd && posts.length > 0 && (
        <Typography sx={{ textAlign: "center", mt: 4, color: "text.secondary" }}>
          End of feed for #{cleanHashtag}.
        </Typography>
      )}
    </Box>
  );
};
