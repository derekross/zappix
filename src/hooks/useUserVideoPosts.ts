import { useInfiniteQuery } from '@tanstack/react-query';
import { NPool, NRelay1 } from '@nostrify/nostrify';
import type { NostrEvent } from '@nostrify/nostrify';

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

// Shared discovery pool to avoid creating multiple connections
let sharedDiscoveryPool: NPool | null = null;

function getDiscoveryPool(): NPool {
  if (!sharedDiscoveryPool) {
    const discoveryRelays = [
      'wss://relay.nostr.band',
      'wss://relay.primal.net', 
      'wss://relay.olas.app',
      'wss://nos.lol',
      'wss://relay.snort.social',
      'wss://purplepag.es'
    ];
    
    sharedDiscoveryPool = new NPool({
      open(url: string) {
        console.log('Discovery pool connecting to relay:', url);
        return new NRelay1(url);
      },
      reqRouter: (filters) => {
        const relayMap = new Map<string, typeof filters>();
        // Use fewer relays to reduce connection load
        for (const url of discoveryRelays) {
          relayMap.set(url, filters);
        }
        return relayMap;
      },
    });
  }
  return sharedDiscoveryPool;
}

export function useUserVideoPosts(pubkey: string) {
  return useInfiniteQuery({
    queryKey: ['user-video-posts', pubkey],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
      const discoveryPool = getDiscoveryPool();

      const filter: {
        kinds: number[];
        authors: string[];
        limit: number;
        until?: number;
      } = {
        kinds: [22, 34236], // Video event kinds
        authors: [pubkey],
        limit: 20,
      };

      if (pageParam) {
        filter.until = pageParam;
      }

      try {
        const events = await discoveryPool.query([filter], { signal: querySignal });
        
        // Filter and validate video events
        const validEvents = events.filter(validateVideoEvent);
        
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
        if (import.meta.env.DEV) {
          console.error('Error querying discovery relays for user videos:', error);
        }
        throw error;
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 300000, // 5 minutes
    enabled: !!pubkey,
  });
}