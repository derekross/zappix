import { useQuery } from '@tanstack/react-query';
import { NPool, NRelay1 } from '@nostrify/nostrify';
import type { NostrEvent } from '@nostrify/nostrify';

// Validator function for NIP-68 image events (more lenient)
function validateImageEvent(event: NostrEvent): boolean {
  // Check if it's a picture event kind
  if (event.kind !== 20) return false;

  // Check for required tags according to NIP-68 (be more lenient)
  const title = event.tags.find(([name]) => name === 'title')?.[1];
  const imeta = event.tags.find(([name]) => name === 'imeta');

  // Picture events should have 'title' and 'imeta' tag, but be more forgiving
  if (!title && !imeta) {
    // If neither title nor imeta, reject
    return false;
  }

  // If we have imeta, do basic validation
  if (imeta && imeta[1] && !imeta[1].includes('url')) {
    return false;
  }

  return true;
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
        console.log('Global feed using shared discovery pool with relays:', [...relayMap.keys()]);
        return relayMap;
      },
      eventRouter: () => discoveryRelays.slice(0, 3),
    });
  }
  return sharedDiscoveryPool;
}

export function useImagePosts(hashtag?: string) {

  return useQuery({
    queryKey: ['image-posts', hashtag],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      
      const discoveryPool = getDiscoveryPool();
      
      // Global and hashtag feeds use discovery relays only (no outbox model)
      const filter: { kinds: number[]; limit: number; '#t'?: string[] } = { 
        kinds: [20], 
        limit: 100
      };

      // Add hashtag filter if specified
      if (hashtag) {
        filter['#t'] = [hashtag];
      }

      console.log('Querying global/hashtag feed from discovery relays...');
      
      try {
        const events = await discoveryPool.query([filter], { signal });
        console.log('Global feed raw events received:', events.length);
        
        const validEvents = events.filter(validateImageEvent);
        console.log('Global feed valid events:', validEvents.length);
        
        // Log unique authors to see diversity
        const uniqueAuthors = [...new Set(validEvents.map(e => e.pubkey))];
        console.log('Global feed unique authors found:', uniqueAuthors.length);
        
        return validEvents.sort((a, b) => b.created_at - a.created_at);
      } catch (error) {
        console.error('Error querying discovery relays:', error);
        throw error;
      }
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

// Shared outbox pool to avoid creating multiple connections
let sharedOutboxPool: NPool | null = null;

function getOutboxPool(): NPool {
  if (!sharedOutboxPool) {
    const defaultRelays = [
      'wss://relay.nostr.band',
      'wss://relay.primal.net', 
      'wss://relay.olas.app',
      'wss://nos.lol'
    ];
    
    // Function to get relay hints for a specific pubkey
    const getRelayHints = async (pubkey: string): Promise<{ writeRelays: string[]; readRelays: string[] }> => {
      try {
        // Use the shared discovery pool for relay list queries to avoid more connections
        const discoveryPool = getDiscoveryPool();
        
        const relayEvents = await discoveryPool.query([{
          kinds: [10002],
          authors: [pubkey],
          limit: 1
        }], { signal: AbortSignal.timeout(3000) });

        if (relayEvents.length === 0) {
          return { writeRelays: [], readRelays: [] };
        }

        const relayList = relayEvents[0];
        const writeRelays: string[] = [];
        const readRelays: string[] = [];

        for (const tag of relayList.tags) {
          if (tag[0] === 'r' && tag[1]) {
            const url = tag[1];
            const marker = tag[2];

            if (!marker) {
              writeRelays.push(url);
              readRelays.push(url);
            } else if (marker === 'write') {
              writeRelays.push(url);
            } else if (marker === 'read') {
              readRelays.push(url);
            }
          }
        }

        return { writeRelays, readRelays };
      } catch {
        return { writeRelays: [], readRelays: [] };
      }
    };
    
    sharedOutboxPool = new NPool({
      open(url: string) {
        console.log('Outbox pool connecting to relay:', url);
        return new NRelay1(url);
      },
      async reqRouter(filters) {
        const relayMap = new Map<string, typeof filters>();
        
        // Add default relays as fallback
        for (const url of defaultRelays) {
          relayMap.set(url, filters);
        }
        
        // For each filter with authors, try to get their write relays
        for (const filter of filters) {
          if (filter.authors && filter.authors.length > 0) {
            console.log('Following feed: Getting relay hints for', filter.authors.length, 'authors');
            
            // Limit to first 10 authors to avoid too many concurrent requests
            const limitedAuthors = filter.authors.slice(0, 10);
            
            // Get relay hints for each author
            const relayHintPromises = limitedAuthors.map(author => getRelayHints(author));
            const relayHints = await Promise.all(relayHintPromises);
            
            // Add each author's write relays
            for (let i = 0; i < limitedAuthors.length; i++) {
              const author = limitedAuthors[i];
              const hints = relayHints[i];
              
              if (hints.writeRelays.length > 0) {
                console.log(`Author ${author.slice(0, 8)} write relays:`, hints.writeRelays.slice(0, 2));
                
                // Add author's write relays (limit to 1 per author to reduce connections)
                for (const relay of hints.writeRelays.slice(0, 1)) {
                  const existingFilters = relayMap.get(relay) || [];
                  relayMap.set(relay, [...existingFilters, { ...filter, authors: [author] }]);
                }
              }
            }
          }
        }
        
        console.log('Following feed routing to relays:', [...relayMap.keys()]);
        return relayMap;
      },
      eventRouter: () => defaultRelays.slice(0, 2),
    });
  }
  return sharedOutboxPool;
}

export function useFollowingImagePosts(followingPubkeys: string[]) {
  return useQuery({
    queryKey: ['following-image-posts', followingPubkeys],
    queryFn: async (c) => {
      if (followingPubkeys.length === 0) {
        console.log('Following feed: No users being followed');
        return [];
      }
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      
      const outboxPool = getOutboxPool();
      
      // Following feed uses outbox model - queries authors' write relays
      console.log('Querying following feed using shared outbox pool for authors:', followingPubkeys.length);
      console.log('Following pubkeys:', followingPubkeys.slice(0, 3).map(pk => pk.slice(0, 8)));
      
      try {
        const events = await outboxPool.query([{ 
          kinds: [20], 
          authors: followingPubkeys,
          limit: 50 
        }], { signal });
        
        console.log('Following feed raw events received:', events.length);
        
        const validEvents = events.filter(validateImageEvent);
        console.log('Following feed valid events:', validEvents.length);
        
        // Log unique authors found
        const uniqueAuthors = [...new Set(validEvents.map(e => e.pubkey))];
        console.log('Following feed unique authors found:', uniqueAuthors.length);
        
        return validEvents.sort((a, b) => b.created_at - a.created_at);
      } catch (error) {
        console.error('Error in following feed query:', error);
        throw error;
      }
    },
    enabled: followingPubkeys.length > 0,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

export function useHashtagImagePosts(hashtags: string[], limit = 3) {
  return useQuery({
    queryKey: ['hashtag-image-posts', hashtags, limit],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Use shared discovery pool to avoid creating more connections
      const discoveryPool = getDiscoveryPool();
      
      // Hashtag feeds use discovery relays only (no outbox model)
      console.log('Querying hashtag feeds using shared discovery pool...');
      
      // Query for each hashtag
      const hashtagResults = await Promise.all(
        hashtags.map(async (hashtag) => {
          const events = await discoveryPool.query([{ 
            kinds: [20], 
            '#t': [hashtag],
            limit 
          }], { signal });
          
          return {
            hashtag,
            posts: events.filter(validateImageEvent).sort((a, b) => b.created_at - a.created_at)
          };
        })
      );
      
      return hashtagResults;
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
  });
}