import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import type { NostrEvent } from "@nostrify/nostrify";
import { getDiscoveryPool } from "@/lib/poolManager";

// Validator function for vertical video events (kind 22 and legacy 34236)
function validateVideoEvent(event: NostrEvent): boolean {
  // Check if it's a vertical video event kind (22 for short-form vertical videos, 34236 for legacy vertical videos)
  if (![22, 34236].includes(event.kind)) return false;

  // For NIP-71 kind 22, check for imeta tag with video content
  if (event.kind === 22) {
    const imetaTags = event.tags.filter(([name]) => name === "imeta");

    // Check if any imeta tag contains video content
    const hasVideoImeta = imetaTags.some(tag => {
      const tagContent = tag.slice(1).join(" ");
      return tagContent.includes("url ") &&
             (tagContent.includes("m video/") ||
              tagContent.includes(".mp4") ||
              tagContent.includes(".webm") ||
              tagContent.includes(".mov"));
    });

    // Also check content field for video URLs as fallback
    const hasVideoInContent = event.content.includes('.mp4') ||
                             event.content.includes('.webm') ||
                             event.content.includes('.mov');

    if (!hasVideoImeta && !hasVideoInContent) return false;
  }

  // For legacy kind 34236, check for basic video content in event.content or tags
  if (event.kind === 34236) {
    // Legacy format may have video URL in content or url tags
    const hasVideoUrl = event.content.includes('.mp4') ||
                       event.content.includes('.webm') ||
                       event.content.includes('.mov') ||
                       event.tags.some(([name, value]) =>
                         name === 'url' && value &&
                         (value.includes('.mp4') || value.includes('.webm') || value.includes('.mov'))
                       );
    if (!hasVideoUrl) return false;
  }

  return true;
}

// Pool management is now centralized in poolManager.ts



export function useVideoPosts(hashtag?: string, location?: string) {
  return useInfiniteQuery({
    queryKey: ["video-posts", hashtag, location],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
      const discoveryPool = getDiscoveryPool();

      const filter: {
        kinds: number[];
        limit: number;
        "#t"?: string[];
        until?: number;
      } = {
        kinds: [22, 34236], // Vertical video events (short-form and legacy vertical videos)
        limit: 20,
      };

      if (hashtag) {
        filter["#t"] = [hashtag];
      }

      if (pageParam) {
        filter.until = pageParam;
      }

      try {
        const events = await discoveryPool.query([filter], { signal: querySignal });
        let validEvents = events.filter(validateVideoEvent);

        // Show all videos regardless of orientation

        // Filter by location if specified
        if (location) {
          validEvents = validEvents.filter(event =>
            event.tags.some(tag =>
              tag[0] === "location" &&
              tag[1] &&
              tag[1].toLowerCase().includes(location.toLowerCase())
            )
          );
        }

        // Deduplicate by ID first, then sort by created_at
        const uniqueEvents = validEvents.filter(
          (event, index, self) => index === self.findIndex(e => e.id === event.id)
        );

        const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);

        return {
          events: sortedEvents,
          nextCursor: sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].created_at : undefined,
        };
      } catch (error) {
        console.error("Error querying discovery relays for videos:", error);
        throw error;
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useFollowingVideoPosts(followingPubkeys: string[]) {
  return useInfiniteQuery({
    queryKey: ["following-video-posts", followingPubkeys],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);

      // If no following pubkeys, return empty result
      if (followingPubkeys.length === 0) {
        return {
          events: [],
          nextCursor: undefined,
        };
      }

      // Use discovery pool for following feed (same as global but with authors filter)
      // The key difference is the authors filter, not the pool
      const discoveryPool = getDiscoveryPool();

      try {
        const filter: {
          kinds: number[];
          authors: string[];
          limit: number;
          until?: number;
        } = {
          kinds: [22, 34236], // Vertical video events (short-form and legacy vertical videos)
          authors: followingPubkeys,
          limit: 10, // Smaller initial page size for faster loading
        };

        // Add pagination using 'until' timestamp
        if (pageParam) {
          filter.until = pageParam;
        }

        const events = await discoveryPool.query([filter], {
          signal: querySignal,
        });

        const validEvents = events.filter(validateVideoEvent);

        // Show all videos regardless of orientation

        // Deduplicate by ID first, then sort by created_at
        const uniqueEvents = validEvents.filter(
          (event, index, self) => index === self.findIndex((e) => e.id === event.id)
        );

        const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);

        return {
          events: sortedEvents,
          nextCursor:
            sortedEvents.length > 0
              ? sortedEvents[sortedEvents.length - 1].created_at
              : undefined,
        };
      } catch (error) {
        console.error("Error in following video feed query:", error);
        throw error;
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

export function useHashtagVideoPosts(hashtags: string[], limit = 3) {
  return useQuery({
    queryKey: ["hashtag-video-posts", hashtags, limit],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Use shared discovery pool to avoid creating more connections
      const discoveryPool = getDiscoveryPool();

      // Hashtag feeds use discovery relays only (no outbox model)
      // Query for each hashtag
      const hashtagResults = await Promise.all(
        hashtags.map(async (hashtag) => {
          const events = await discoveryPool.query(
            [
              {
                kinds: [22, 34236], // Vertical video events (short-form and legacy vertical videos)
                "#t": [hashtag],
                limit,
              },
            ],
            { signal }
          );

          return {
            hashtag,
            posts: events
              .filter(validateVideoEvent)
              .sort((a, b) => b.created_at - a.created_at),
          };
        })
      );

      return hashtagResults;
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
  });
}