import { useInfiniteQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import { getDiscoveryPool } from "@/lib/poolManager";
import { filterDeletedEvents } from './useDeletedEvents';
import { validateImageEvent } from '@/lib/validators';

export function useUserImagePosts(pubkey: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['user-image-posts', pubkey],
    queryFn: async ({ pageParam, signal }) => {
      if (!pubkey) {
        return { events: [], nextCursor: undefined };
      }

      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);

      const discoveryPool = getDiscoveryPool();



      try {
        const filter: { kinds: number[]; authors: string[]; limit: number; until?: number } = {
          kinds: [20],
          authors: [pubkey],
          limit: 15 // Smaller initial page size for faster loading
        };

        // Add pagination using 'until' timestamp
        if (pageParam) {
          filter.until = pageParam;
        }

        const events = await discoveryPool.query([filter], { signal: querySignal });

        const validEvents = events.filter(validateImageEvent);

        // Deduplicate by event ID (O(n)) to prevent duplicates from multiple relays
        const byId = new Map<string, NostrEvent>();
        for (const event of validEvents) {
          if (!byId.has(event.id)) byId.set(event.id, event);
        }
        const sortedEvents = [...byId.values()].sort((a, b) => b.created_at - a.created_at);

        // Filter out events deleted by their author (NIP-09)
        const filteredEvents = await filterDeletedEvents(sortedEvents, discoveryPool, querySignal);

        return {
          events: filteredEvents,
          // Stop only when we get fewer raw events than the limit we requested;
          // the cursor comes from the raw page so filtering can't end pagination early
          nextCursor: events.length < filter.limit ? undefined : Math.min(...events.map(e => e.created_at)),
        };
      } catch (error) {
        console.error('User image posts query error:', error);
        throw error;
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!pubkey,
    staleTime: 30000, // 30 seconds
  });
}