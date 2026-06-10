import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import type { NostrEvent, NostrFilter } from "@nostrify/nostrify";
import { useNostr } from '@nostrify/react';
import { getDiscoveryPool } from "@/lib/poolManager";
import { filterDeletedEvents } from './useDeletedEvents';
import { useMutedUsers } from './useMutedUsers';
import { validateVideoEvent } from '@/lib/validators';

interface FeedOptions {
  enabled?: boolean;
}

/** Deduplicate by event id (O(n)) and sort newest first. */
function dedupeAndSort(events: NostrEvent[]): NostrEvent[] {
  const byId = new Map<string, NostrEvent>();
  for (const event of events) {
    if (!byId.has(event.id)) byId.set(event.id, event);
  }
  return [...byId.values()].sort((a, b) => b.created_at - a.created_at);
}

/**
 * Compute the pagination cursor from the RAW relay page, not the filtered
 * one — otherwise a page where every event is muted/deleted/invalid would
 * end pagination even though older events exist.
 */
function nextCursorFrom(rawEvents: NostrEvent[]): number | undefined {
  if (rawEvents.length === 0) return undefined;
  return Math.min(...rawEvents.map((e) => e.created_at));
}

export function useAllVideoPosts(hashtag?: string, location?: string, orientation?: 'vertical' | 'horizontal' | 'all', options: FeedOptions = {}) {
  const { data: mutedUsers = [] } = useMutedUsers();

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

      const sortedEvents = dedupeAndSort(validEvents);

      // Filter out muted users
      const unmutedEvents = sortedEvents.filter(event => !mutedUsers.includes(event.pubkey));

      // Filter out events deleted by their authors (NIP-09)
      const filteredEvents = await filterDeletedEvents(unmutedEvents, discoveryPool, querySignal);

      return {
        events: filteredEvents,
        nextCursor: nextCursorFrom(events),
      };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: options.enabled ?? true,
    staleTime: 60000, // 1 minute
    refetchInterval: false, // Disable automatic refetching to prevent constant refreshing
    retry: 1, // Single retry for faster response
    retryDelay: 1000, // Fixed 1 second retry delay
    maxPages: 15, // Limit to 15 pages (150 posts) to prevent memory issues
    gcTime: 3 * 60 * 1000, // Clean up after 3 minutes
  });
}

export function useFollowingAllVideoPosts(followingPubkeys: string[], orientation?: 'vertical' | 'horizontal' | 'all', options: FeedOptions = {}) {
  const { nostr } = useNostr();
  const { data: mutedUsers = [] } = useMutedUsers();

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
      const sortedEvents = dedupeAndSort(validEvents);

      // Filter out muted users
      const unmutedEvents = sortedEvents.filter(event => !mutedUsers.includes(event.pubkey));

      // Filter out events deleted by their authors (NIP-09)
      const filteredEvents = await filterDeletedEvents(unmutedEvents, nostr, querySignal);

      return {
        events: filteredEvents,
        nextCursor: nextCursorFrom(allEvents),
      };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: (options.enabled ?? true) && followingPubkeys.length > 0,
    staleTime: 60000, // 1 minute
    refetchInterval: false,
    retry: 1,
    retryDelay: 1000,
    maxPages: 15,
    gcTime: 5 * 60 * 1000,
  });
}

export function useHashtagAllVideoPosts(hashtags: string[], limit = 3, orientation?: 'vertical' | 'horizontal' | 'all') {
  const { data: mutedUsers = [] } = useMutedUsers();

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

          const validEvents = events
            .filter(validateVideoEvent)
            // Filter out muted users
            .filter(event => !mutedUsers.includes(event.pubkey));

          // All videos are vertical by design (NIP-71 short videos: kinds 22, 34236)

          const sortedEvents = validEvents.sort((a, b) => b.created_at - a.created_at);

          // Filter out events deleted by their authors (NIP-09)
          const filteredEvents = await filterDeletedEvents(sortedEvents, discoveryPool, signal);

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
