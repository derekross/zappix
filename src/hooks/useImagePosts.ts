import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useOptimizedFeedLoader } from "./useOptimizedFeedLoader";
import type { NostrEvent } from "@nostrify/nostrify";
import { getDiscoveryPool, getOutboxPool } from "@/lib/poolManager";
import { useDeletedEvents, filterDeletedEvents } from './useDeletedEvents';

// Validator function for NIP-68 image events (more lenient)
function validateImageEvent(event: NostrEvent): boolean {
  // Check if it's a picture event kind
  if (event.kind !== 20) return false;

  // Check for required tags according to NIP-68 (be more lenient)
  const title = event.tags.find(([name]) => name === "title")?.[1];
  const imeta = event.tags.find(([name]) => name === "imeta");

  // Picture events should have 'title' and 'imeta' tag, but be more forgiving
  if (!title && !imeta) {
    // If neither title nor imeta, reject
    return false;
  }

  // If we have imeta, do basic validation
  if (imeta && imeta[1] && !imeta[1].includes("url")) {
    return false;
  }

  return true;
}

// Pool management is now centralized in poolManager.ts

export function useImagePosts(hashtag?: string, location?: string) {
  const { data: deletionData } = useDeletedEvents();

  return useInfiniteQuery({
    queryKey: ["image-posts", hashtag, location],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]); // Faster timeout
      const discoveryPool = getDiscoveryPool();

      const filter: {
        kinds: number[];
        limit: number;
        "#t"?: string[];
        until?: number;
      } = {
        kinds: [20],
        limit: 15, // Smaller page size for faster loading
      };

      if (hashtag) {
        filter["#t"] = [hashtag];
      }

      if (pageParam) {
        filter.until = pageParam;
      }

      try {
        const events = await discoveryPool.query([filter], { signal: querySignal });
        let validEvents = events.filter(validateImageEvent);

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

        const sortedEvents = validEvents
          .sort((a, b) => b.created_at - a.created_at)
          .filter((event, index, self) => index === self.findIndex(e => e.id === event.id));

        // Filter out deleted events if deletion data is available
        const filteredEvents = deletionData
          ? filterDeletedEvents(sortedEvents, deletionData.deletedEventIds, deletionData.deletedEventCoordinates)
          : sortedEvents;

        return {
          events: filteredEvents,
          nextCursor: filteredEvents.length > 0 ? filteredEvents[filteredEvents.length - 1].created_at : undefined,
        };
      } catch (error) {

        throw error;
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60000, // 1 minute - keep data fresh longer
    refetchInterval: false, // Disable automatic refetching
    retry: 1, // Reduce retries for faster response
    retryDelay: 1000, // Shorter retry delay
  });
}

export function useFollowingImagePosts(followingPubkeys: string[]) {
  return useInfiniteQuery({
    queryKey: ["following-image-posts", followingPubkeys],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(6000)]); // Faster timeout

      // Use outbox model for following feed
      const outboxPool = getOutboxPool();

      try {
        const filter: {
          kinds: number[];
          authors: string[];
          limit: number;
          until?: number;
        } = {
          kinds: [20],
          authors: followingPubkeys,
          limit: 12, // Slightly larger for following feed since it's more targeted
        };

        // Add pagination using 'until' timestamp
        if (pageParam) {
          filter.until = pageParam;
        }

        const events = await outboxPool.query([filter], {
          signal: querySignal,
        });

        console.log("Following feed raw events received:", events.length);

        const validEvents = events.filter(validateImageEvent);
        console.log("Following feed valid events:", validEvents.length);

        // Log unique authors found
        const uniqueAuthors = [...new Set(validEvents.map((e) => e.pubkey))];
        console.log(
          "Following feed unique authors found:",
          uniqueAuthors.length
        );

        // Sort by created_at and deduplicate by ID
        const sortedEvents = validEvents
          .sort((a, b) => b.created_at - a.created_at)
          .filter(
            (event, index, self) =>
              index === self.findIndex((e) => e.id === event.id)
          );

        return {
          events: sortedEvents,
          nextCursor:
            sortedEvents.length > 0
              ? sortedEvents[sortedEvents.length - 1].created_at
              : undefined,
        };
      } catch (error) {

        throw error;
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: followingPubkeys.length > 0, // Only run query if we have pubkeys to follow
    staleTime: 60000, // 1 minute
    refetchInterval: false, // Disable automatic refetching
    retry: 1, // Reduce retries for faster response
    retryDelay: 1000, // Shorter retry delay
  });
}

export function useHashtagImagePosts(hashtags: string[], limit = 3) {
  return useQuery({
    queryKey: ["hashtag-image-posts", hashtags, limit],
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
                kinds: [20],
                "#t": [hashtag],
                limit,
              },
            ],
            { signal }
          );

          return {
            hashtag,
            posts: events
              .filter(validateImageEvent)
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
