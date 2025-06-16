import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { NostrEvent, NPool, NRelay1, NostrFilter } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';

interface NostrProviderProps {
  children: React.ReactNode;
}

// Cache for relay lists to avoid repeated queries
const relayListCache = new Map<string, { writeRelays: string[]; readRelays: string[] }>();

// Special cache for the current user's relay list (updated by OutboxEnhancer)
let currentUserRelayList: { writeRelays: string[]; readRelays: string[] } | null = null;
let currentUserPubkey: string | null = null;

// Function to update current user relay list (called by OutboxEnhancer)
export function updateCurrentUserRelayList(pubkey: string | null, relayList: { writeRelays: string[]; readRelays: string[] } | null) {
  currentUserPubkey = pubkey;
  currentUserRelayList = relayList;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { defaultRelays } = useAppContext();

  const queryClient = useQueryClient();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const defaultRelayUrls = useRef<string[]>(defaultRelays.map(r => r.url));

  // Update refs when default relays change
  useEffect(() => {
    defaultRelayUrls.current = defaultRelays.map(r => r.url);
    queryClient.resetQueries();
  }, [defaultRelays, queryClient]);

  // Function to get relay hints for a specific pubkey
  const getRelayHints = useCallback(async (pubkey: string, signal?: AbortSignal) => {
    // Check cache first
    if (relayListCache.has(pubkey)) {
      return relayListCache.get(pubkey)!;
    }

    try {
      // Create a simple pool for this query that doesn't use outbox model routing to avoid recursion
      const tempPool = new NPool({
        open(url: string) {
          return new NRelay1(url);
        },
        reqRouter: (filters) => {
          // Simple routing: just use default relays, no outbox model
          const relayMap = new Map<string, typeof filters>();
          
          // Add default relays
          for (const url of defaultRelayUrls.current.slice(0, 3)) {
            relayMap.set(url, filters);
          }
          
          return relayMap;
        },
        eventRouter: () => defaultRelayUrls.current.slice(0, 2),
      });

      // Query for the user's relay list
      const relayEvents = await tempPool.query([{
        kinds: [10002],
        authors: [pubkey],
        limit: 1
      }], { signal: signal || AbortSignal.timeout(2000) });

      if (relayEvents.length === 0) {
        const fallback = { writeRelays: [], readRelays: [] };
        relayListCache.set(pubkey, fallback);
        return fallback;
      }

      const relayList = relayEvents[0];
      const writeRelays: string[] = [];
      const readRelays: string[] = [];

      // Parse relay tags
      for (const tag of relayList.tags) {
        if (tag[0] === 'r' && tag[1]) {
          const url = tag[1];
          const marker = tag[2];

          if (!marker) {
            // No marker means both read and write
            writeRelays.push(url);
            readRelays.push(url);
          } else if (marker === 'write') {
            writeRelays.push(url);
          } else if (marker === 'read') {
            readRelays.push(url);
          }
        }
      }

      const hints = { writeRelays, readRelays };
      relayListCache.set(pubkey, hints);
      return hints;
    } catch {
      const fallback = { writeRelays: [], readRelays: [] };
      relayListCache.set(pubkey, fallback);
      return fallback;
    }
  }, []);

  // Memoize the pool configuration
  const poolConfig = useMemo(() => ({
    open(url: string) {
      return new NRelay1(url);
    },
    async reqRouter(filters: NostrFilter[]) {
      const relayMap = new Map<string, NostrFilter[]>();
      
      // Add default relays for all queries (global feeds now use dedicated pools)
      for (const url of defaultRelayUrls.current) {
        relayMap.set(url, filters);
      }

      try {
        // OUTBOX MODEL: Only apply for specific query patterns
        for (const filter of filters) {
          // Apply outbox model only for following feeds (queries with specific authors but no hashtags)
          const isFollowingFeed = filter.authors && filter.authors.length > 0 && !filter['#t'];
          
          if (isFollowingFeed && filter.authors) {
            console.log('Routing following feed query for authors:', filter.authors);
            // For each author, try to get their relay hints
            for (const author of filter.authors) {
              try {
                // If querying for current user's content, use their cached write relays
                if (author === currentUserPubkey && currentUserRelayList?.writeRelays.length) {
                  for (const relay of currentUserRelayList.writeRelays.slice(0, 3)) {
                    const existingFilters = relayMap.get(relay) || [];
                    relayMap.set(relay, [...existingFilters, { ...filter, authors: [author] }]);
                  }
                } else {
                  // For other authors, try to get their relay hints
                  const hints = await getRelayHints(author);
                  for (const relay of hints.writeRelays.slice(0, 2)) { // Limit to 2 relays per author
                    const existingFilters = relayMap.get(relay) || [];
                    relayMap.set(relay, [...existingFilters, { ...filter, authors: [author] }]);
                  }
                }
              } catch {
                // Ignore errors for individual authors
              }
            }
          }
          
          // INBOX MODEL: For mentions, use mentioned users' read relays (where they check mentions)
          if (filter['#p'] && Array.isArray(filter['#p'])) {
            const mentionedUsers = filter['#p'];
            for (const mentionedUser of mentionedUsers) {
              try {
                // If querying for current user's mentions, use their cached read relays
                if (mentionedUser === currentUserPubkey && currentUserRelayList?.readRelays.length) {
                  for (const relay of currentUserRelayList.readRelays.slice(0, 2)) {
                    const existingFilters = relayMap.get(relay) || [];
                    relayMap.set(relay, [...existingFilters, filter]);
                  }
                } else {
                  // For other users, try to get their relay hints
                  const hints = await getRelayHints(mentionedUser);
                  for (const relay of hints.readRelays.slice(0, 1)) { // Limit to 1 relay per mention
                    const existingFilters = relayMap.get(relay) || [];
                    relayMap.set(relay, [...existingFilters, filter]);
                  }
                }
              } catch {
                // Ignore errors for individual mentions
              }
            }
          }
        }
      } catch {
        // If outbox routing fails, we already have fallback relays
      }
      
      return relayMap;
    },
    async eventRouter(event: NostrEvent) {
      const relays = new Set<string>();
      
      // Add default relays as fallback
      for (const url of defaultRelayUrls.current.slice(0, 2)) {
        relays.add(url);
      }
      
      try {
        // OUTBOX MODEL: Use the event author's write relays (where they publish their content)
        
        // If this is the current user's event, use their cached relay list first
        if (event.pubkey === currentUserPubkey && currentUserRelayList?.writeRelays.length) {
          console.log('Using current user write relays for outbox:', currentUserRelayList.writeRelays);
          for (const relay of currentUserRelayList.writeRelays.slice(0, 3)) {
            relays.add(relay);
          }
        } else {
          // For other users, try to get their relay hints
          const authorHints = await getRelayHints(event.pubkey);
          for (const relay of authorHints.writeRelays.slice(0, 3)) {
            relays.add(relay);
          }
        }

        // INBOX MODEL: For events with mentions, also publish to mentioned users' read relays
        const mentionedUsers = event.tags
          .filter(([name]) => name === 'p')
          .map(([, pubkey]) => pubkey);

        if (mentionedUsers.length > 0) {
          console.log('Publishing to mentioned users read relays:', mentionedUsers);
          const mentionRelayPromises = mentionedUsers.map(pubkey => getRelayHints(pubkey));
          const mentionRelayHints = await Promise.all(mentionRelayPromises);

          for (const hints of mentionRelayHints) {
            for (const relay of hints.readRelays.slice(0, 1)) { // 1 relay per mentioned user
              relays.add(relay);
              if (relays.size >= 8) break; // Cap total relays
            }
            if (relays.size >= 8) break;
          }
        }
      } catch (error) {
        console.warn('Error in outbox/inbox routing:', error);
      }
      
      // Add remaining default relays as additional fallbacks
      if (relays.size < 5) {
        for (const url of defaultRelayUrls.current) {
          relays.add(url);
          if (relays.size >= 6) break; // Reasonable limit
        }
      }
      
      const finalRelays = [...relays];
      console.log('Event will be published to relays:', finalRelays);
      return finalRelays;
    },
  }), [getRelayHints]);

  // Initialize NPool only once, but update when config changes
  useEffect(() => {
    pool.current = new NPool(poolConfig);
  }, [poolConfig]);

  if (!pool.current) {
    pool.current = new NPool(poolConfig);
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;