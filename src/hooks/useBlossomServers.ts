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
        console.log('Blossom servers: No user logged in');
        return [];
      }

      console.log('Blossom servers: Querying for user:', user.pubkey);
      
      try {
        // First try with the main nostr pool (outbox model)
        console.log('Blossom servers: Trying outbox model query...');
        let events = await nostr.query([{
          kinds: [10063],
          authors: [user.pubkey],
          limit: 10
        }], { signal: AbortSignal.timeout(3000) });

        console.log('Blossom servers: Outbox model found events:', events.length);

        // If no events found, try a direct query to default relays
        if (events.length === 0) {
          console.log('Blossom servers: Trying direct query to default relays...');
          
          // Create a direct pool that queries all default relays
          const directPool = new NPool({
            open(url: string) {
              console.log('Blossom servers: Connecting directly to:', url);
              return new NRelay1(url);
            },
            reqRouter: (filters) => {
              const relayMap = new Map<string, typeof filters>();
              // Query all default relays directly
              for (const relay of defaultRelays) {
                relayMap.set(relay.url, filters);
              }
              console.log('Blossom servers: Direct query to relays:', [...relayMap.keys()]);
              return relayMap;
            },
            eventRouter: () => defaultRelays.map(r => r.url).slice(0, 3),
          });

          events = await directPool.query([{
            kinds: [10063],
            authors: [user.pubkey],
            limit: 10
          }], { signal: AbortSignal.timeout(4000) });

          console.log('Blossom servers: Direct query found events:', events.length);
        }
        
        if (events.length === 0) {
          console.log('Blossom servers: No kind 10063 events found for user on any relays');
          return [];
        }

        // Log all events for debugging
        events.forEach((event, index) => {
          console.log(`Blossom event ${index}:`, {
            id: event.id,
            created_at: event.created_at,
            tags: event.tags,
            content: event.content
          });
        });

        // Get the most recent event
        const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
        console.log('Blossom servers: Using latest event:', latestEvent.id);
        
        // Validate the event
        if (!validateBlossomEvent(latestEvent)) {
          console.log('Blossom servers: Latest event failed validation');
          return [];
        }
        
        // Extract server URLs from tags
        const servers = latestEvent.tags
          .filter(([name]) => name === 'server')
          .map(([, url]) => url)
          .filter(Boolean);

        console.log('Blossom servers: Extracted servers:', servers);
        return servers;
      } catch (error) {
        console.error('Blossom servers: Query error:', error);
        return [];
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function validateBlossomEvent(event: NostrEvent): boolean {
  console.log('Validating blossom event:', event.id);
  
  // Check if it's a blossom server list event
  if (event.kind !== 10063) {
    console.log('Validation failed: Wrong kind', event.kind);
    return false;
  }

  // Check for at least one server tag
  const serverTags = event.tags.filter(([name]) => name === 'server');
  console.log('Found server tags:', serverTags);
  
  if (serverTags.length === 0) {
    console.log('Validation failed: No server tags found');
    return false;
  }

  // Validate that server tags have URLs
  const isValid = serverTags.every(([, url]) => {
    try {
      new URL(url);
      console.log('Valid server URL:', url);
      return true;
    } catch {
      console.log('Invalid server URL:', url);
      return false;
    }
  });
  
  console.log('Event validation result:', isValid);
  return isValid;
}