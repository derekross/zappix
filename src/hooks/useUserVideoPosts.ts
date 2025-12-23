import { useInfiniteQuery } from '@tanstack/react-query';
import { getDiscoveryPool } from "@/lib/poolManager";
import { useDeletedEvents, filterDeletedEvents } from './useDeletedEvents';
import { useOutboxModel } from './useOutboxModel';
import { useNostr } from '@nostrify/react';
import { validateVideoEvent } from '@/lib/validators';

export function useUserVideoPosts(pubkey: string) {
  const { data: deletionData } = useDeletedEvents();
  const { routeRequest } = useOutboxModel();
  const { nostr } = useNostr();

  return useInfiniteQuery({
    queryKey: ['user-video-posts', pubkey],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);

      // Use the same comprehensive approach as global/following feeds
      // First try outbox model, then fallback to discovery pool, then combine results
      const fallbackRelays = [
        "wss://relay.nostr.band",
        "wss://relay.damus.io",
        "wss://relay.primal.net",
        "wss://relay.olas.app",
        "wss://nos.lol",
        "wss://relay.snort.social",
        "wss://purplepag.es",
        "wss://ditto.pub/relay",
      ];

      const filter: {
        kinds: number[];
        authors: string[];
        limit: number;
        since?: number; // Use since instead of until for better pagination
      } = {
        kinds: [22, 34236], // Video event kinds
        authors: [pubkey],
        limit: 25, // Increased limit to get more results
      };

      if (pageParam) {
        filter.since = pageParam;
      }

      const allEvents: NostrEvent[] = [];

      // Strategy 1: Try outbox model first
      try {
        const relayMap = await routeRequest([filter], fallbackRelays);

        const relayPromises = Array.from(relayMap.entries()).map(async ([relay, filters]) => {
          try {
            const events = await nostr.query(filters, { signal: querySignal });
            return events;
          } catch (error) {
            console.warn(`Outbox relay ${relay} failed:`, error);
            return [];
          }
        });

        const outboxEvents = await Promise.all(relayPromises);
        allEvents.push(...outboxEvents.flat());

        } catch {
      }

      // Strategy 2: Always try discovery pool as well (like global feed)
      // This ensures we get events that might not be on the user's write relays
      try {
        const discoveryPool = getDiscoveryPool();
        const discoveryEvents = await discoveryPool.query([filter], { signal: querySignal });
        allEvents.push(...discoveryEvents);

        } catch {
      }



      // Filter and validate video events
      const validEvents = allEvents.filter(validateVideoEvent);



      // Deduplicate by ID first, then sort by created_at
      const uniqueEvents = validEvents.filter(
        (event, index, self) => index === self.findIndex(e => e.id === event.id)
      );

      const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);

      // Filter out deleted events if deletion data is available
      let filteredEvents = sortedEvents;
      if (deletionData) {
        filteredEvents = filterDeletedEvents(sortedEvents, deletionData.deletedEventIds, deletionData.deletedEventCoordinates);


      }

      return {
        events: filteredEvents,
        nextCursor: filteredEvents.length > 0 ? filteredEvents[filteredEvents.length - 1].created_at : undefined,
      };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
        // Find the oldest event timestamp and use it as since parameter
        if (lastPage.events.length === 0) return undefined;
        const oldestTimestamp = Math.min(...lastPage.events.map(e => e.created_at));
        return oldestTimestamp - 1; // Subtract 1 to avoid overlap
      },
    staleTime: 30000, // 30 seconds for better development experience
    enabled: !!pubkey,
    retry: 2, // Add retry logic for better reliability
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}