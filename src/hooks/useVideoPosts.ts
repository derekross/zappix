import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { NPool, NRelay1 } from "@nostrify/nostrify";
import type { NostrEvent } from "@nostrify/nostrify";

// Validator function for vertical video events (kind 22 and 34236)
function validateVideoEvent(event: NostrEvent): boolean {
  // Check if it's a vertical video event kind (22 for NIP-71 short videos, 34236 for additional vertical videos)
  if (![22, 34236].includes(event.kind)) return false;

  // Check for required tags according to NIP-71
  const title = event.tags.find(([name]) => name === "title")?.[1];
  const imeta = event.tags.find(([name]) => name === "imeta");

  // Video events require 'title' tag
  if (!title) return false;

  // For kind 22 (NIP-71), title and imeta are required
  // For kind 34236, we'll be more lenient and only require imeta
  if (event.kind === 22) {
    // NIP-71 requires title tag
    if (!title) return false;
  }

  // Should have imeta tag with video content
  if (!imeta) return false;

  // Basic validation of imeta tag structure
  if (imeta[1] && !imeta[1].includes("url")) {
    return false;
  }

  return true;
}

// Get a shared discovery pool to avoid creating too many connections
let discoveryPool: NPool | null = null;
function getDiscoveryPool() {
  if (!discoveryPool) {
    const relayUrls = [
      "wss://relay.nostr.band",
      "wss://relay.damus.io",
      "wss://relay.primal.net",
    ];
    discoveryPool = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter: (filters) => {
        const relayMap = new Map<string, typeof filters>();
        for (const url of relayUrls) {
          relayMap.set(url, filters);
        }
        return relayMap;
      },
      eventRouter: () => relayUrls.slice(0, 2),
    });
  }
  return discoveryPool;
}

// Get a shared outbox pool for following feed
let outboxPool: NPool | null = null;
function getOutboxPool() {
  if (!outboxPool) {
    const relayUrls = [
      "wss://relay.nostr.band",
      "wss://relay.damus.io",
      "wss://relay.primal.net",
    ];
    outboxPool = new NPool({
      open(url: string) {
        return new NRelay1(url);
      },
      reqRouter: (filters) => {
        const relayMap = new Map<string, typeof filters>();
        for (const url of relayUrls) {
          relayMap.set(url, filters);
        }
        return relayMap;
      },
      eventRouter: () => relayUrls.slice(0, 2),
    });
  }
  return outboxPool;
}

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
        kinds: [22, 34236], // Vertical videos (NIP-71 short videos and kind 34236)
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

      // Use outbox model for following feed
      const outboxPool = getOutboxPool();

      try {
        const filter: {
          kinds: number[];
          authors: string[];
          limit: number;
          until?: number;
        } = {
          kinds: [22, 34236], // Vertical videos (NIP-71 short videos and kind 34236)
          authors: followingPubkeys,
          limit: 10, // Smaller initial page size for faster loading
        };

        // Add pagination using 'until' timestamp
        if (pageParam) {
          filter.until = pageParam;
        }

        const events = await outboxPool.query([filter], {
          signal: querySignal,
        });

        console.log("Following video feed raw events received:", events.length);

        const validEvents = events.filter(validateVideoEvent);
        console.log("Following video feed valid events:", validEvents.length);

        // Log unique authors found
        const uniqueAuthors = [...new Set(validEvents.map((e) => e.pubkey))];
        console.log(
          "Following video feed unique authors found:",
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
      console.log("Querying hashtag video feeds using shared discovery pool...");

      // Query for each hashtag
      const hashtagResults = await Promise.all(
        hashtags.map(async (hashtag) => {
          const events = await discoveryPool.query(
            [
              {
                kinds: [22, 34236], // Vertical videos (NIP-71 short videos and kind 34236)
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