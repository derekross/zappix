import { useInfiniteQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import { getDiscoveryPool, getRelay } from "@/lib/poolManager";
import { filterDeletedEvents } from './useDeletedEvents';
import { useOutboxModel } from './useOutboxModel';
import { validateVideoEvent } from '@/lib/validators';

// Cap how many outbox relays we hit per page on top of the discovery pool
const MAX_OUTBOX_RELAYS = 4;

export function useUserVideoPosts(pubkey: string) {
  const { routeRequest } = useOutboxModel();

  return useInfiniteQuery({
    queryKey: ['user-video-posts', pubkey],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);

      // Query the author's write relays (outbox model) plus the discovery pool
      const fallbackRelays = [
        "wss://relay.ditto.pub",
        "wss://relay.damus.io",
        "wss://relay.primal.net",
        "wss://relay.olas.app",
      ];

      const filter: {
        kinds: number[];
        authors: string[];
        limit: number;
        until?: number;
      } = {
        kinds: [22, 34236], // Video event kinds
        authors: [pubkey],
        limit: 25,
      };

      if (pageParam) {
        filter.until = pageParam;
      }

      const allEvents: NostrEvent[] = [];

      // Strategy 1: the author's write relays per the outbox model
      try {
        const relayMap = await routeRequest([filter], fallbackRelays);

        const relayPromises = Array.from(relayMap.entries())
          .slice(0, MAX_OUTBOX_RELAYS)
          .map(async ([relay, filters]) => {
            try {
              return await getRelay(relay).query(filters, { signal: querySignal });
            } catch (error) {
              console.warn(`Outbox relay ${relay} failed:`, error);
              return [];
            }
          });

        const outboxEvents = await Promise.all(relayPromises);
        allEvents.push(...outboxEvents.flat());
      } catch {
        // Outbox model failed, continue with discovery pool
      }

      // Strategy 2: Always try discovery pool as well (like global feed)
      // This ensures we get events that might not be on the user's write relays
      const discoveryPool = getDiscoveryPool();
      try {
        const discoveryEvents = await discoveryPool.query([filter], { signal: querySignal });
        allEvents.push(...discoveryEvents);
      } catch {
        // Discovery pool failed, continue with what we have
      }

      // Filter and validate video events
      const validEvents = allEvents.filter(validateVideoEvent);

      // Deduplicate by ID (O(n)), then sort by created_at
      const byId = new Map<string, NostrEvent>();
      for (const event of validEvents) {
        if (!byId.has(event.id)) byId.set(event.id, event);
      }
      const sortedEvents = [...byId.values()].sort((a, b) => b.created_at - a.created_at);

      // Filter out events deleted by their author (NIP-09)
      const filteredEvents = await filterDeletedEvents(sortedEvents, discoveryPool, querySignal);

      return {
        events: filteredEvents,
        // Cursor comes from the RAW result set so a fully-filtered page
        // doesn't end pagination early
        nextCursor: allEvents.length > 0
          ? Math.min(...allEvents.map((e) => e.created_at))
          : undefined,
      };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30000, // 30 seconds
    enabled: !!pubkey,
    retry: 2, // Add retry logic for better reliability
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}
