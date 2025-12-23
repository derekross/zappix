import { useInfiniteQuery } from '@tanstack/react-query';
import { getDiscoveryPool } from "@/lib/poolManager";
import { useDeletedEvents, filterDeletedEvents } from './useDeletedEvents';
import { validateImageEvent } from '@/lib/validators';

export function useUserImagePosts(pubkey: string | undefined) {
  const { data: deletionData } = useDeletedEvents();

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

        console.log('User image posts raw events received:', events.length);

        const validEvents = events.filter(validateImageEvent);
        console.log('User image posts valid events:', validEvents.length);

        // Deduplicate by event ID to prevent duplicates from multiple relays
        const uniqueEvents = validEvents.reduce((acc, event) => {
          if (!acc.find(e => e.id === event.id)) {
            acc.push(event);
          }
          return acc;
        }, [] as NostrEvent[]);

        console.log('User image posts unique events:', uniqueEvents.length);

        const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);

        // Filter out deleted events if deletion data is available
        const filteredEvents = deletionData
          ? filterDeletedEvents(sortedEvents, deletionData.deletedEventIds, deletionData.deletedEventCoordinates)
          : sortedEvents;

        return {
          events: filteredEvents,
          // Stop only when we get fewer raw events than the limit we requested
          nextCursor: events.length < filter.limit ? undefined : filteredEvents[filteredEvents.length - 1]?.created_at,
        };
      } catch (error) {
        
        throw error;
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!pubkey,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}