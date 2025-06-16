import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useOutboxModel } from './useOutboxModel';

// Default discovery relays for profile metadata fallback
const DISCOVERY_RELAYS = [
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
  'wss://relay.olas.app',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://purplepag.es'
];

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();
  const { routeRequest } = useOutboxModel();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
      }

      console.log(`Fetching profile for pubkey: ${pubkey}`);

      try {
        // First try using outbox model to route to user's write relays
        const filter = { kinds: [0], authors: [pubkey], limit: 1 };
        const relayMap = await routeRequest([filter], DISCOVERY_RELAYS);
        
        console.log(`Profile query routed to ${relayMap.size} relays:`, [...relayMap.keys()]);

        // Query all routed relays in parallel
        const queryPromises = Array.from(relayMap.entries()).map(async ([relay, filters]) => {
          try {
            console.log(`Querying profile from relay: ${relay}`);
            const events = await nostr.query(filters, { 
              signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) 
            });
            return events;
          } catch (error) {
            console.warn(`Failed to query profile from relay ${relay}:`, error);
            return [];
          }
        });

        const results = await Promise.allSettled(queryPromises);
        const allEvents: NostrEvent[] = [];

        // Collect all successful results
        for (const result of results) {
          if (result.status === 'fulfilled') {
            allEvents.push(...result.value);
          }
        }

        console.log(`Profile query found ${allEvents.length} events total`);

        // Find the most recent profile event
        const event = allEvents
          .filter(e => e.kind === 0 && e.pubkey === pubkey)
          .sort((a, b) => b.created_at - a.created_at)[0];

        if (!event) {
          console.warn(`No profile found for pubkey: ${pubkey}`);
          throw new Error('No profile event found');
        }

        console.log(`Using profile event from ${new Date(event.created_at * 1000).toISOString()}`);

        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          return { metadata, event };
        } catch (parseError) {
          console.warn('Failed to parse profile metadata:', parseError);
          return { event };
        }
      } catch (outboxError) {
        console.warn('Outbox model failed, falling back to discovery relays:', outboxError);
        
        // Fallback to discovery relays only
        const [event] = await nostr.query(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]) },
        );

        if (!event) {
          throw new Error('No profile event found in fallback');
        }

        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          return { metadata, event };
        } catch {
          return { event };
        }
      }
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
