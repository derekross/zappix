import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NPool, NRelay1 } from '@nostrify/nostrify';
import type { NostrEvent } from '@nostrify/nostrify';

import { useCurrentUser } from './useCurrentUser';
import { useAppContext } from './useAppContext';

export function useBlossomServers() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { defaultRelays } = useAppContext();

  return useQuery({
    queryKey: ['blossom-servers', user?.pubkey],
    queryFn: async (_c) => {
      if (!user) {
        return [];
      }
      
      try {
        // First try with the main nostr pool (outbox model)
        let events = await nostr.query([{
          kinds: [10063],
          authors: [user.pubkey],
          limit: 10
        }], { signal: AbortSignal.timeout(3000) });

        // If no events found, try a direct query to default relays
        if (events.length === 0) {
          // Create a direct pool that queries all default relays
          const directPool = new NPool({
            open(url: string) {
              return new NRelay1(url);
            },
            reqRouter: (filters) => {
              const relayMap = new Map<string, typeof filters>();
              // Query all default relays directly
              for (const relay of defaultRelays) {
                relayMap.set(relay.url, filters);
              }
              return relayMap;
            },
            eventRouter: () => defaultRelays.map(r => r.url).slice(0, 3),
          });

          events = await directPool.query([{
            kinds: [10063],
            authors: [user.pubkey],
            limit: 10
          }], { signal: AbortSignal.timeout(4000) });
        }
        
        if (events.length === 0) {
          return [];
        }

        // Get the most recent event
        const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
        
        // Validate the event
        if (!validateBlossomEvent(latestEvent)) {
          return [];
        }
        
        // Extract server URLs from tags
        const servers = latestEvent.tags
          .filter(([name]) => name === 'server')
          .map(([, url]) => url)
          .filter(Boolean);

        return servers;
      } catch {
        return [];
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function validateBlossomEvent(event: NostrEvent): boolean {
  // Check if it's a blossom server list event
  if (event.kind !== 10063) {
    return false;
  }

  // Check for at least one server tag
  const serverTags = event.tags.filter(([name]) => name === 'server');
  
  if (serverTags.length === 0) {
    return false;
  }

  // Validate that server tags have URLs
  const isValid = serverTags.every(([, url]) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
  
  return isValid;
}