import { useOptimizedFeedLoader } from './useOptimizedFeedLoader';
import { getDiscoveryPool, getOutboxPool } from '@/lib/poolManager';
import { useDeletedEvents, filterDeletedEvents } from './useDeletedEvents';
import { useFollowing } from './useFollowing';
import type { NostrEvent } from '@nostrify/nostrify';

// Validator function for NIP-68 image events (more lenient)
function validateImageEvent(event: NostrEvent): boolean {
  // Check if it's a picture event kind
  if (event.kind !== 20) return false;

  // Must have content or tags
  if (!event.content && !event.tags?.length) return false;

  // Check for image URL in tags or content
  const hasImageUrl = event.tags?.some(([name, value]) => {
    if (name === 'url' && value) {
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(value);
    }
    return false;
  }) || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(event.content);

  return hasImageUrl;
}

export function useOptimizedImagePosts(hashtag?: string, location?: string) {
  return useOptimizedFeedLoader({
    feedType: 'images',
    queryKey: ['optimized-image-posts', hashtag, location],
    queryFn: async ({ limit, pageParam, signal, hashtag: queryHashtag, location: queryLocation }) => {
      const filter = {
        kinds: [20],
        limit,
        ...(pageParam && { until: pageParam }),
        ...(queryHashtag && { '#t': [queryHashtag] }),
        ...(queryLocation && { '#l': [queryLocation] }),
      };

      try {
        // Try discovery pool first
        const relayMap = await getDiscoveryPool().query([filter], { signal });
        let events = await Promise.all(
          Array.from(relayMap.entries()).map(async ([, filters]) => {
            try {
              return await getDiscoveryPool().query(filters, { signal });
            } catch {
              return [];
            }
          })
        ).then(results => results.flat());

        // If discovery pool returned no results, try outbox model
        if (events.length === 0) {
          try {
            const outboxRelayMap = await getOutboxPool().query([filter], { signal });
            events = await Promise.all(
              Array.from(outboxRelayMap.entries()).map(async ([, filters]) => {
                try {
                  return await getOutboxPool().query(filters, { signal });
                } catch {
                  return [];
                }
              })
            ).then(results => results.flat());
          } catch {
            // Outbox model failed, continue with empty results
          }
        }

        // Filter and validate events
        let validEvents = events.filter(validateImageEvent);

        // Filter out deleted events
        const { data: deletionData } = await useDeletedEvents.fetch();
        if (deletionData) {
          validEvents = filterDeletedEvents(
            validEvents,
            deletionData.deletedEventIds,
            deletionData.deletedEventCoordinates
          );
        }

        // Deduplicate by ID first, then sort by created_at
        const uniqueEvents = validEvents.filter(
          (event, index, self) => index === self.findIndex(e => e.id === event.id)
        );

        const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);

        return {
          events: sortedEvents,
          nextCursor: sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].created_at : undefined,
        };
      } catch (error) {
        console.error('Error in optimized image posts query:', error);
        return {
          events: [],
          nextCursor: undefined,
        };
      }
    },
    hashtag,
    location,
    enabled: true,
  });
}

export function useOptimizedFollowingImagePosts(followingPubkeys: string[]) {
  return useOptimizedFeedLoader({
    feedType: 'images',
    queryKey: ['optimized-following-image-posts', followingPubkeys.slice(0, 10)], // Limit key size
    queryFn: async ({ limit, pageParam, signal, followingPubkeys: pubkeys }) => {
      if (pubkeys.length === 0) {
        return { events: [], nextCursor: undefined };
      }

      const filter = {
        kinds: [20],
        authors: pubkeys,
        limit,
        ...(pageParam && { until: pageParam }),
      };

      try {
        // Use outbox model to route requests to followed users' write relays
        const relayMap = await getOutboxPool().query([filter], { signal });
        const events = await Promise.all(
          Array.from(relayMap.entries()).map(async ([, filters]) => {
            try {
              return await getOutboxPool().query(filters, { signal });
            } catch {
              return [];
            }
          })
        ).then(results => results.flat());

        // Filter and validate events
        let validEvents = events.filter(validateImageEvent);

        // Filter out deleted events
        const { data: deletionData } = await useDeletedEvents.fetch();
        if (deletionData) {
          validEvents = filterDeletedEvents(
            validEvents,
            deletionData.deletedEventIds,
            deletionData.deletedEventCoordinates
          );
        }

        // Deduplicate by ID first, then sort by created_at
        const uniqueEvents = validEvents.filter(
          (event, index, self) => index === self.findIndex(e => e.id === event.id)
        );

        const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);

        return {
          events: sortedEvents,
          nextCursor: sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].created_at : undefined,
        };
      } catch (error) {
        console.error('Error in optimized following image posts query:', error);
        return {
          events: [],
          nextCursor: undefined,
        };
      }
    },
    followingPubkeys,
    enabled: followingPubkeys.length > 0,
  });
}