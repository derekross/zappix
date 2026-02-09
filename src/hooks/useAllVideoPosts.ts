import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import type { NostrFilter } from "@nostrify/nostrify";
import { useNostr } from '@nostrify/react';
import { getDiscoveryPool } from "@/lib/poolManager";
import { useDeletedEvents, filterDeletedEvents } from './useDeletedEvents';
import { validateVideoEvent } from '@/lib/validators';



export function useAllVideoPosts(hashtag?: string, location?: string, orientation?: 'vertical' | 'horizontal' | 'all') {
  const { data: deletionData } = useDeletedEvents();

  return useInfiniteQuery({
    queryKey: ["all-video-posts", hashtag, location, orientation],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]); // Faster timeout
      const discoveryPool = getDiscoveryPool();

      const filter: {
        kinds: number[];
        limit: number;
        "#t"?: string[];
        until?: number;
      } = {
        kinds: [22, 32222, 34236], // Vertical videos: NIP-71 short (22, 34236) + OpenVine (32222)
        limit: 10, // Smaller page size for faster video loading
      };

      if (hashtag) {
        filter["#t"] = [hashtag];
      }

      if (pageParam) {
        filter.until = pageParam;
      }

      const events = await discoveryPool.query([filter], { signal: querySignal });

      let validEvents = events.filter(validateVideoEvent);

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

      // Filter out deleted events if deletion data is available
      const filteredEvents = deletionData
        ? filterDeletedEvents(sortedEvents, deletionData.deletedEventMap, deletionData.deletedCoordinateMap)
        : sortedEvents;

      return {
        events: filteredEvents,
        nextCursor: filteredEvents.length > 0 ? filteredEvents[filteredEvents.length - 1].created_at : undefined,
      };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60000, // 1 minute
    refetchInterval: false, // Disable automatic refetching to prevent constant refreshing
    retry: 1, // Single retry for faster response
    retryDelay: 1000, // Fixed 1 second retry delay
    maxPages: 15, // Limit to 15 pages (150 posts) to prevent memory issues
    gcTime: 3 * 60 * 1000, // Clean up after 3 minutes
  });
}

export function useFollowingAllVideoPosts(followingPubkeys: string[], orientation?: 'vertical' | 'horizontal' | 'all') {
  const { nostr } = useNostr();
  const { data: deletionData } = useDeletedEvents();

  // Create a stable query key by sorting and stringifying the pubkeys array
  const stableFollowingKey = followingPubkeys.length > 0 ? followingPubkeys.slice().sort().join(',') : 'empty';

  return useInfiniteQuery({
    queryKey: ["following-all-video-posts", stableFollowingKey, orientation],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(8000)]);

      // If no following pubkeys, return empty result
      if (followingPubkeys.length === 0) {
        return {
          events: [],
          nextCursor: undefined,
        };
      }

      // Build filter
      const filter: NostrFilter = {
        kinds: [22, 32222, 34236], // Vertical videos: NIP-71 short (22, 34236) + OpenVine (32222)
        authors: followingPubkeys,
        limit: 15,
      };

      // Add pagination using 'until' timestamp
      if (pageParam) {
        filter.until = pageParam;
      }

      // Query user's read relays (via NostrProvider) AND discovery pool (for video-specific relays)
      // NostrProvider routes to user's NIP-65 read relays automatically
      const [userRelayEvents, discoveryEvents] = await Promise.all([
        nostr.query([filter], { signal: querySignal }).catch(() => []),
        getDiscoveryPool().query([filter], { signal: querySignal }).catch(() => []),
      ]);

      // Combine results from both pools
      const allEvents = [...userRelayEvents, ...discoveryEvents];

      const validEvents = allEvents.filter(validateVideoEvent);

      // Deduplicate by ID first, then sort by created_at
      const uniqueEvents = validEvents.filter(
        (event, index, self) => index === self.findIndex((e) => e.id === event.id)
      );

      const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);

      // Filter out deleted events if deletion data is available
      const filteredEvents = deletionData
        ? filterDeletedEvents(sortedEvents, deletionData.deletedEventMap, deletionData.deletedCoordinateMap)
        : sortedEvents;

      return {
        events: filteredEvents,
        nextCursor:
          filteredEvents.length > 0
            ? filteredEvents[filteredEvents.length - 1].created_at
            : undefined,
      };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: followingPubkeys.length > 0,
    staleTime: 60000, // 1 minute
    refetchInterval: false,
    retry: 1,
    retryDelay: 1000,
    maxPages: 15,
    gcTime: 5 * 60 * 1000,
  });
}

export function useHashtagAllVideoPosts(hashtags: string[], limit = 3, orientation?: 'vertical' | 'horizontal' | 'all') {
  const { data: deletionData } = useDeletedEvents();

  return useQuery({
    queryKey: ["hashtag-all-video-posts", hashtags, limit, orientation],
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
                kinds: [22, 32222, 34236], // Vertical videos: NIP-71 short (22, 34236) + OpenVine (32222)
                "#t": [hashtag],
                limit,
              },
            ],
            { signal }
          );

          const validEvents = events.filter(validateVideoEvent);

          // All videos are vertical by design (NIP-71 short videos: kinds 22, 34236)

          const sortedEvents = validEvents.sort((a, b) => b.created_at - a.created_at);

          // Filter out deleted events if deletion data is available
          const filteredEvents = deletionData
            ? filterDeletedEvents(sortedEvents, deletionData.deletedEventMap, deletionData.deletedCoordinateMap)
            : sortedEvents;

          return {
            hashtag,
            posts: filteredEvents,
          };
        })
      );

      return hashtagResults;
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
  });
}