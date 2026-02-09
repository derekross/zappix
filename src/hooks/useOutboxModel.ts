
import { useNostr } from '@nostrify/react';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

interface RelayHints {
  writeRelays: string[];
  readRelays: string[];
}

// Cache for relay lists to avoid repeated queries (with max size to prevent memory leaks)
const MAX_RELAY_CACHE_SIZE = 500;
const relayListCache = new Map<string, RelayHints>();

function setRelayListCacheEntry(key: string, value: RelayHints) {
  // Evict oldest entries if cache is full
  if (relayListCache.size >= MAX_RELAY_CACHE_SIZE) {
    const firstKey = relayListCache.keys().next().value;
    if (firstKey) relayListCache.delete(firstKey);
  }
  relayListCache.set(key, value);
}

export function useOutboxModel() {
  const { nostr } = useNostr();

  // Function to get relay hints for a specific pubkey
  const getRelayHints = async (pubkey: string): Promise<RelayHints> => {
    // Check cache first
    if (relayListCache.has(pubkey)) {
      return relayListCache.get(pubkey)!;
    }

    try {
      // Query for the user's relay list
      const relayEvents = await nostr.query([{
        kinds: [10002],
        authors: [pubkey],
        limit: 1
      }], { signal: AbortSignal.timeout(8000) }); // Increased timeout to 8 seconds

      if (relayEvents.length === 0) {
        const fallback = { writeRelays: [], readRelays: [] };
        setRelayListCacheEntry(pubkey, fallback);
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
      setRelayListCacheEntry(pubkey, hints);
      return hints;
    } catch {
      const fallback = { writeRelays: [], readRelays: [] };
      setRelayListCacheEntry(pubkey, fallback);
      return fallback;
    }
  };

  // Function to route requests based on outbox model
  const routeRequest = async (filters: NostrFilter[], fallbackRelays: string[] = []) => {
    const relayMap = new Map<string, NostrFilter[]>();

    // Add fallback relays for all filters
    for (const relay of fallbackRelays) {
      relayMap.set(relay, filters);
    }

    // Process each filter
    for (const filter of filters) {
      // For author-based queries, use their write relays
      if (filter.authors && filter.authors.length > 0) {
        const authorRelayPromises = filter.authors.map(author => getRelayHints(author));
        const authorRelayHints = await Promise.all(authorRelayPromises);

        for (let i = 0; i < filter.authors.length; i++) {
          const author = filter.authors[i];
          const hints = authorRelayHints[i];

          // Use author's write relays (where they publish)
          for (const relay of hints.writeRelays.slice(0, 3)) { // Limit to 3 relays per author
            const existingFilters = relayMap.get(relay) || [];
            const authorFilter = { ...filter, authors: [author] };
            relayMap.set(relay, [...existingFilters, authorFilter]);
          }
        }
      }

      // For mention queries (#p tags), use mentioned users' read relays
      if (filter['#p'] && Array.isArray(filter['#p'])) {
        const mentionedUsers = filter['#p'];
        const mentionRelayPromises = mentionedUsers.map(pubkey => getRelayHints(pubkey));
        const mentionRelayHints = await Promise.all(mentionRelayPromises);

        for (let i = 0; i < mentionedUsers.length; i++) {
          const hints = mentionRelayHints[i];

          // Use mentioned user's read relays (where they read mentions)
          for (const relay of hints.readRelays.slice(0, 2)) { // Limit to 2 relays per mention
            const existingFilters = relayMap.get(relay) || [];
            relayMap.set(relay, [...existingFilters, filter]);
          }
        }
      }
    }

    return relayMap;
  };

  // Function to route events for publishing
  const routeEvent = async (event: NostrEvent, userWriteRelays: string[] = [], fallbackRelays: string[] = []) => {
    const relays = new Set<string>();

    // Add user's write relays
    for (const relay of userWriteRelays.slice(0, 3)) {
      relays.add(relay);
    }

    // Add fallback relays
    for (const relay of fallbackRelays.slice(0, 2)) {
      relays.add(relay);
    }

    // For events with mentions, also publish to mentioned users' read relays
    const mentionedUsers = event.tags
      .filter(([name]) => name === 'p')
      .map(([, pubkey]) => pubkey);

    if (mentionedUsers.length > 0) {
      try {
        const mentionRelayPromises = mentionedUsers.map(pubkey => getRelayHints(pubkey));
        const mentionRelayHints = await Promise.all(mentionRelayPromises);

        for (const hints of mentionRelayHints) {
          for (const relay of hints.readRelays.slice(0, 1)) { // 1 relay per mentioned user
            relays.add(relay);
            if (relays.size >= 7) break; // Cap total relays
          }
          if (relays.size >= 7) break;
        }
      } catch {
        // Ignore errors in relay hint lookup for mentions
      }
    }

    return [...relays];
  };

  // Function to clear cache (useful for testing or manual refresh)
  const clearCache = () => {
    relayListCache.clear();
  };

  return {
    getRelayHints,
    routeRequest,
    routeEvent,
    clearCache,
  };
}

// Utility functions that can be used without hooks
export const outboxUtils = {
  // Function to clear the relay list cache
  clearRelayCache: () => {
    relayListCache.clear();
  },

  // Function to manually add relay hints to cache
  setRelayHints: (pubkey: string, hints: RelayHints) => {
    setRelayListCacheEntry(pubkey, hints);
  },

  // Function to get cached relay hints
  getCachedRelayHints: (pubkey: string): RelayHints | undefined => {
    return relayListCache.get(pubkey);
  },
};