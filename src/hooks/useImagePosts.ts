import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import type { NostrEvent } from "@nostrify/nostrify";
import { getDiscoveryPool } from "@/lib/poolManager";
import { filterDeletedEvents } from './useDeletedEvents';
import { useMutedUsers } from './useMutedUsers';
import { validateImageEvent } from '@/lib/validators';

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

export function useImagePosts(hashtag?: string, location?: string, options: FeedOptions = {}) {
  const { data: mutedUsers = [] } = useMutedUsers();

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
    staleTime: 60000, // 1 minute - keep data fresh longer
    refetchInterval: false, // Disable automatic refetching
    retry: 1, // Reduce retries for faster response
    retryDelay: 1000, // Shorter retry delay
    maxPages: 15, // Cap retained pages to prevent unbounded memory growth
  });
}

export function useFollowingImagePosts(followingPubkeys: string[], options: FeedOptions = {}) {
  const { nostr } = useNostr();
  const { data: mutedUsers = [] } = useMutedUsers();

  // Stable query key regardless of follow-list ordering
  const stableFollowingKey = followingPubkeys.length > 0 ? [...followingPubkeys].sort().join(',') : 'empty';

  return useInfiniteQuery({
    queryKey: ["following-image-posts", stableFollowingKey],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(6000)]);

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
    staleTime: 60000,
    refetchInterval: false,
    retry: 1,
    retryDelay: 1000,
    maxPages: 15, // Cap retained pages to prevent unbounded memory growth
  });
}

export function useHashtagImagePosts(hashtags: string[], limit = 3) {
  const { data: mutedUsers = [] } = useMutedUsers();

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
