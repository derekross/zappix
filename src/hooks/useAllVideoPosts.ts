import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { NPool, NRelay1 } from "@nostrify/nostrify";
import type { NostrEvent } from "@nostrify/nostrify";

// Validator function for vertical video events (NIP-71 kind 22 and legacy kind 34236)
function validateVideoEvent(event: NostrEvent): boolean {
  // Check for NIP-71 short-form video events (kind 22)
  if (event.kind === 22) {
    // For NIP-71 video events, check for imeta tag with video content
    const imetaTags = event.tags.filter(([name]) => name === "imeta");
    
    // Check if any imeta tag contains video content
    const hasVideoImeta = imetaTags.some(tag => {
      const tagContent = tag.slice(1).join(" ");
      return tagContent.includes("url ") && 
             (tagContent.includes("m video/") || 
              tagContent.includes("m application/x-mpegURL")); // Include HLS streams
    });
    
    // Also check for title tag which is required for NIP-71
    const hasTitle = event.tags.some(([name]) => name === "title");
    
    return hasVideoImeta && hasTitle;
  }
  
  // Check for legacy vertical video events (kind 34236)
  if (event.kind === 34236) {
    // For legacy kind 34236, check for imeta tag with video content
    const imetaTags = event.tags.filter(([name]) => name === "imeta");
    
    // Check if any imeta tag contains video content
    const hasVideoImeta = imetaTags.some(tag => {
      const tagContent = tag.slice(1).join(" ");
      return tagContent.includes("url ") && 
             tagContent.includes("m video/");
    });
    
    // Also check for standalone m and x tags (legacy format)
    const hasMimeTag = event.tags.some(([name, value]) => name === "m" && value?.startsWith("video/"));
    const hasHashTag = event.tags.some(([name]) => name === "x");
    
    return hasVideoImeta || (hasMimeTag && hasHashTag);
  }

  return false;
}

// Get a shared discovery pool to avoid creating too many connections
let discoveryPool: NPool | null = null;
let poolInitialized = false;

function getDiscoveryPool() {
  if (!discoveryPool || !poolInitialized) {
    const relayUrls = [
      "wss://relay.nostr.band",
      "wss://relay.damus.io", 
      "wss://relay.primal.net",
      "wss://nos.lol",
      "wss://relay.snort.social",
    ];
    
    try {
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
        eventRouter: () => relayUrls.slice(0, 3),
      });
      poolInitialized = true;
    } catch (error) {
      console.error("Failed to initialize discovery pool:", error);
      // Reset so we can try again next time
      discoveryPool = null;
      poolInitialized = false;
      throw error;
    }
  }
  return discoveryPool;
}



export function useAllVideoPosts(hashtag?: string, location?: string, orientation?: 'vertical' | 'horizontal' | 'all') {
  return useInfiniteQuery({
    queryKey: ["all-video-posts", hashtag, location, orientation],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
      const discoveryPool = getDiscoveryPool();

      const filter: {
        kinds: number[];
        limit: number;
        "#t"?: string[];
        until?: number;
      } = {
        kinds: [22, 34236], // Vertical video events only (NIP-71 short-form + legacy)
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
    refetchInterval: false, // Disable automatic refetching to prevent constant refreshing
    retry: 2, // Reduce retry attempts
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

export function useFollowingAllVideoPosts(followingPubkeys: string[], orientation?: 'vertical' | 'horizontal' | 'all') {
  // Create a stable query key by sorting and stringifying the pubkeys array
  const stableFollowingKey = followingPubkeys.length > 0 ? followingPubkeys.slice().sort().join(',') : 'empty';
  
  return useInfiniteQuery({
    queryKey: ["following-all-video-posts", stableFollowingKey, orientation],
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
      const discoveryPool = getDiscoveryPool();

      try {
        const filter: {
          kinds: number[];
          authors: string[];
          limit: number;
          until?: number;
        } = {
          kinds: [22, 34236], // Vertical video events only (NIP-71 short-form + legacy)
          authors: followingPubkeys.slice(), // Create a copy to avoid reference issues
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
    enabled: followingPubkeys.length > 0, // Only run query if we have pubkeys to follow
    staleTime: 30000, // 30 seconds
    refetchInterval: false, // Disable automatic refetching to prevent constant refreshing
    retry: 2, // Reduce retry attempts
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

export function useHashtagAllVideoPosts(hashtags: string[], limit = 3, orientation?: 'vertical' | 'horizontal' | 'all') {
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
                kinds: [22, 34236], // Vertical video events only (NIP-71 short-form + legacy)
                "#t": [hashtag],
                limit,
              },
            ],
            { signal }
          );

          const validEvents = events.filter(validateVideoEvent);

          // All videos are vertical by design (kind 22 and 34236 are vertical-only)

          return {
            hashtag,
            posts: validEvents.sort((a, b) => b.created_at - a.created_at),
          };
        })
      );

      return hashtagResults;
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
  });
}