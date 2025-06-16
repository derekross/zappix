import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { NPool, NRelay1 } from "@nostrify/nostrify";
import type { NostrEvent } from "@nostrify/nostrify";

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

export function useImagePosts(hashtag?: string, location?: string) {
  return useInfiniteQuery({
    queryKey: ["image-posts", hashtag, location],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);

      const discoveryPool = getDiscoveryPool();

      // Global and hashtag feeds use discovery relays only (no outbox model)
      const filter: {
        kinds: number[];
        limit: number;
        "#t"?: string[];
        location?: string[];
        until?: number;
      } = {
        kinds: [20],
        limit: 10, // Smaller initial page size for faster loading
      };

      // Add hashtag filter if specified
      if (hashtag) {
        filter["#t"] = [hashtag];
      }

      // Add location filter if specified
      if (location) {
        filter["location"] = [location];
      }

      // Add pagination using 'until' timestamp
      if (pageParam) {
        filter.until = pageParam;
      }

      console.log(
        "Querying global/hashtag feed from discovery relays...",
        pageParam ? `until ${pageParam}` : "initial"
      );

      try {
        const events = await discoveryPool.query([filter], {
          signal: querySignal,
        });
        console.log("Global feed raw events received:", events.length);

        const validEvents = events.filter(validateImageEvent);
        console.log("Global feed valid events:", validEvents.length);

        // Log unique authors to see diversity
        const uniqueAuthors = [...new Set(validEvents.map((e) => e.pubkey))];
        console.log("Global feed unique authors found:", uniqueAuthors.length);

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
        console.error("Error querying discovery relays:", error);
        throw error;
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

export function useFollowingImagePosts(followingPubkeys: string[]) {
  return useInfiniteQuery({
    queryKey: ["following-image-posts", followingPubkeys],
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
          kinds: [20],
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
        console.error("Error in following feed query:", error);
        throw error;
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
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
      console.log("Querying hashtag feeds using shared discovery pool...");

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
