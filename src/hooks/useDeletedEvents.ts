import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook to track deleted events according to NIP-09
 * Queries for kind 5 (deletion request) events and tracks which events have been deleted
 */
export function useDeletedEvents() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['deleted-events'],
    queryFn: async (context) => {
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(10000)]);
      
      try {
        // Query for all deletion request events (kind 5)
        const deletionEvents = await nostr.query([{ 
          kinds: [5],
          limit: 1000 // Adjust based on needs
        }], { signal });

        // Extract deleted event IDs from deletion requests
        const deletedEventIds = new Set<string>();
        const deletedEventCoordinates = new Set<string>(); // For addressable events (a tags)

        deletionEvents.forEach((deletionEvent) => {
          // Process 'e' tags (regular event IDs)
          const eTags = deletionEvent.tags.filter(([name]) => name === 'e');
          eTags.forEach(([, eventId]) => {
            if (eventId) {
              deletedEventIds.add(eventId);
            }
          });

          // Process 'a' tags (addressable event coordinates)
          const aTags = deletionEvent.tags.filter(([name]) => name === 'a');
          aTags.forEach(([, coordinate]) => {
            if (coordinate) {
              deletedEventCoordinates.add(coordinate);
            }
          });
        });


        return {
          deletedEventIds,
          deletedEventCoordinates,
          deletionEvents
        };
      } catch (error) {
        console.error('Failed to fetch deleted events:', error);
        return {
          deletedEventIds: new Set<string>(),
          deletedEventCoordinates: new Set<string>(),
          deletionEvents: []
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Utility function to check if an event has been deleted
 * @param event - The event to check
 * @param deletedEventIds - Set of deleted event IDs
 * @param deletedEventCoordinates - Set of deleted addressable event coordinates
 * @returns true if the event has been deleted
 */
export function isEventDeleted(
  event: NostrEvent,
  deletedEventIds: Set<string>,
  deletedEventCoordinates: Set<string>
): boolean {
  // Check if event ID is in deleted events
  if (deletedEventIds.has(event.id)) {
    return true;
  }

  // For addressable events (kinds 30000-39999), check coordinates
  if (event.kind >= 30000 && event.kind < 40000) {
    const dTag = event.tags.find(([name]) => name === 'd')?.[1] || '';
    const coordinate = `${event.kind}:${event.pubkey}:${dTag}`;
    if (deletedEventCoordinates.has(coordinate)) {
      return true;
    }
  }

  return false;
}

/**
 * Utility function to filter out deleted events from an array
 * @param events - Array of events to filter
 * @param deletedEventIds - Set of deleted event IDs
 * @param deletedEventCoordinates - Set of deleted addressable event coordinates
 * @returns Filtered array with deleted events removed
 */
export function filterDeletedEvents(
  events: NostrEvent[],
  deletedEventIds: Set<string>,
  deletedEventCoordinates: Set<string>
): NostrEvent[] {
  return events.filter((event) => 
    !isEventDeleted(event, deletedEventIds, deletedEventCoordinates)
  );
}

/**
 * Hook to get a filtered list of events with deleted events removed
 * @param events - Array of events to filter
 * @returns Filtered events with deleted events removed
 */
export function useFilteredEvents(events: NostrEvent[] | undefined) {
  const { data: deletionData } = useDeletedEvents();

  if (!events || !deletionData) {
    return events || [];
  }

  return filterDeletedEvents(
    events,
    deletionData.deletedEventIds,
    deletionData.deletedEventCoordinates
  );
}