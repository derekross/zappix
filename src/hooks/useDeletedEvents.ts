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
        // Map from event ID -> deletion author pubkey (for author validation per NIP-09)
        const deletedEventMap = new Map<string, string>();
        const deletedCoordinateMap = new Map<string, string>(); // coordinate -> deletion author pubkey

        deletionEvents.forEach((deletionEvent) => {
          // Process 'e' tags (regular event IDs)
          const eTags = deletionEvent.tags.filter(([name]) => name === 'e');
          eTags.forEach(([, eventId]) => {
            if (eventId) {
              deletedEventMap.set(eventId, deletionEvent.pubkey);
            }
          });

          // Process 'a' tags (addressable event coordinates)
          const aTags = deletionEvent.tags.filter(([name]) => name === 'a');
          aTags.forEach(([, coordinate]) => {
            if (coordinate) {
              deletedCoordinateMap.set(coordinate, deletionEvent.pubkey);
            }
          });
        });


        return {
          deletedEventMap,
          deletedCoordinateMap,
          deletionEvents
        };
      } catch (error) {
        console.error('Failed to fetch deleted events:', error);
        return {
          deletedEventMap: new Map<string, string>(),
          deletedCoordinateMap: new Map<string, string>(),
          deletionEvents: []
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Utility function to check if an event has been deleted.
 * Per NIP-09, a deletion is only valid if the deletion event author
 * matches the author of the event being deleted.
 * @param event - The event to check
 * @param deletedEventMap - Map of event ID -> deletion author pubkey
 * @param deletedCoordinateMap - Map of coordinate -> deletion author pubkey
 * @returns true if the event has been deleted by its author
 */
export function isEventDeleted(
  event: NostrEvent,
  deletedEventMap: Map<string, string>,
  deletedCoordinateMap: Map<string, string>
): boolean {
  // Check if event ID is in deleted events AND the deletion author matches the event author
  const deletionAuthor = deletedEventMap.get(event.id);
  if (deletionAuthor && deletionAuthor === event.pubkey) {
    return true;
  }

  // For addressable events (kinds 30000-39999), check coordinates
  if (event.kind >= 30000 && event.kind < 40000) {
    const dTag = event.tags.find(([name]) => name === 'd')?.[1] || '';
    const coordinate = `${event.kind}:${event.pubkey}:${dTag}`;
    const coordDeletionAuthor = deletedCoordinateMap.get(coordinate);
    if (coordDeletionAuthor && coordDeletionAuthor === event.pubkey) {
      return true;
    }
  }

  return false;
}

/**
 * Utility function to filter out deleted events from an array
 * @param events - Array of events to filter
 * @param deletedEventMap - Map of event ID -> deletion author pubkey
 * @param deletedCoordinateMap - Map of coordinate -> deletion author pubkey
 * @returns Filtered array with deleted events removed
 */
export function filterDeletedEvents(
  events: NostrEvent[],
  deletedEventMap: Map<string, string>,
  deletedCoordinateMap: Map<string, string>
): NostrEvent[] {
  return events.filter((event) => 
    !isEventDeleted(event, deletedEventMap, deletedCoordinateMap)
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
    deletionData.deletedEventMap,
    deletionData.deletedCoordinateMap
  );
}