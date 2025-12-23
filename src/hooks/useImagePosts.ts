import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { getDiscoveryPool } from "@/lib/poolManager";
import { useDeletedEvents, filterDeletedEvents } from './useDeletedEvents';
import { useMutedUsers } from './useMutedUsers';
import { validateImageEvent } from '@/lib/validators';

export function useImagePosts(hashtag?: string, location?: string) {
  const { data: deletionData } = useDeletedEvents();
  const { data: mutedUsers = [] } = useMutedUsers();

  return useInfiniteQuery({
    queryKey: ["image-posts", hashtag, location, mutedUsers],
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

        // Filter out muted users
        const unmutedEvents = sortedEvents.filter(event => !mutedUsers.includes(event.pubkey));

        // Filter out deleted events if deletion data is available
        const filteredEvents = deletionData
          ? filterDeletedEvents(unmutedEvents, deletionData.deletedEventIds, deletionData.deletedEventCoordinates)
          : unmutedEvents;

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
  const { nostr } = useNostr();

  return useInfiniteQuery({
    queryKey: ["following-image-posts", followingPubkeys],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(6000)]);

      try {
        const filter: {
          kinds: number[];
          authors: string[];
          limit: number;
          until?: number;
        } = {
          kinds: [20],
          authors: followingPubkeys,
          limit: 12,
        };

        // Add pagination using 'until' timestamp
        if (pageParam) {
          filter.until = pageParam;
        }

        // Query user's read relays (via NostrProvider) AND discovery pool
        // NostrProvider routes to user's NIP-65 read relays automatically
        const [userRelayEvents, discoveryEvents] = await Promise.all([
          nostr.query([filter], { signal: querySignal }).catch(() => []),
          getDiscoveryPool().query([filter], { signal: querySignal }).catch(() => []),
        ]);

        // Combine results from both pools
        const allEvents = [...userRelayEvents, ...discoveryEvents];

        const validEvents = allEvents.filter(validateImageEvent);

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
    enabled: followingPubkeys.length > 0,
    staleTime: 60000,
    refetchInterval: false,
    retry: 1,
    retryDelay: 1000,
  });
}

export function useHashtagImagePosts(hashtags: string[], limit = 3) {
  const { data: mutedUsers = [] } = useMutedUsers();

  return useQuery({
    queryKey: ["hashtag-image-posts", hashtags, limit, mutedUsers],
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
                limit: limit * 2, // Query more to account for filtered posts
              },
            ],
            { signal }
          );

          return {
            hashtag,
            posts: events
              .filter(validateImageEvent)
              // Filter out muted users
              .filter(event => !mutedUsers.includes(event.pubkey))
              .sort((a, b) => b.created_at - a.created_at)
              .slice(0, limit), // Limit after filtering
          };
        })
      );

      return hashtagResults;
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
  });
}
