import { useOptimizedFeedLoader } from './useOptimizedFeedLoader';
import { getDiscoveryPool, getOutboxPool } from '@/lib/poolManager';
import { useDeletedEvents, filterDeletedEvents } from './useDeletedEvents';
import { useFollowing } from './useFollowing';
import type { NostrEvent } from '@nostrify/nostrify';

// Validator function for video events (supports both formats)
function validateVideoEvent(event: NostrEvent): boolean {
  // Check for NIP-71 short-form video events (kind 22)
  if (event.kind === 22) {
    // For NIP-71 video events, check for imeta tag with video content
    const imetaTags = event.tags.filter(([name]) => name === 'imeta');

    // Check if any imeta tag contains video content
    const hasVideoImeta = imetaTags.some(tag => {
      // Handle multiple formats more flexibly
      let hasUrl = false;
      let hasVideoMime = false;

      // Join all tag elements after first one to create content string
      const tagContent = tag.slice(1).join(' ');

      // Look for URL in any format
      const urlMatch = tagContent.match(/(?:^|\s)url\s+(\S+)/);
      hasUrl = !!urlMatch;

      // Look for video MIME type in any format
      const mimeMatch = tagContent.match(/\bm\s+(video\/[^\s]+|application\/x-mpegURL)/);
      hasVideoMime = !!mimeMatch;

      // Also check for video file extensions as backup
      if (hasUrl && !hasVideoMime) {
        const url = urlMatch![1];
        hasVideoMime = /\.(mp4|webm|mov|avi|mkv|3gp|m4v)$/i.test(url);
      }

      return hasUrl && hasVideoMime;
    });

    // Also check for single-string imeta format (like user's event)
    const hasSingleStringImeta = event.tags.some(([name, value]) => {
      if (name !== 'imeta' || !value) return false;
      
      // Check if single string contains both url and video mime type
      const hasUrl = value.includes('url https://') || value.includes('url http://');
      const hasVideoMime = value.includes('m video/') || value.includes('m application/x-mpegURL');
      
      // Also check for video file extensions
      const hasVideoExtension = /\.(mp4|webm|mov|avi|mkv|3gp|m4v)/i.test(value);
      
      return hasUrl && (hasVideoMime || hasVideoExtension);
    });

    // Check for simple URL tags as additional fallback
    const hasVideoUrl = event.tags.some(([name, value]) => {
      if (name !== 'url') return false;
      if (!value) return false;
      return /\.(mp4|webm|mov|avi|mkv|3gp|m4v)$/i.test(value) ||
             value.includes('video') ||
             value.includes('.webm') ||
             value.includes('.mp4');
    });

    // For kind 22, we're more permissive - just need video content
    return hasVideoImeta || hasSingleStringImeta || hasVideoUrl;
  }

  // Check for legacy vertical video events (kind 34236)
  if (event.kind === 34236) {
    // Legacy format - look for m and x tags
    const hasMimeTag = event.tags.some(([name, value]) => name === 'm' && value?.startsWith('video/'));
    const hasHashTag = event.tags.some(([name]) => name === 'x');
    const hasUrlTag = event.tags.some(([name, value]) => name === 'url' && value);

    return hasMimeTag && hasHashTag && hasUrlTag;
  }

  return false;
}

export function useOptimizedAllVideoPosts(
  hashtag?: string, 
  location?: string, 
  orientation: 'vertical' | 'horizontal' | 'all' = 'vertical'
) {
  return useOptimizedFeedLoader({
    feedType: 'videos',
    queryKey: ['optimized-all-video-posts', hashtag, location, orientation],
    queryFn: async ({ limit, pageParam, signal, hashtag: queryHashtag, location: queryLocation }) => {
      const filter = {
        kinds: [22, 34236], // Video event kinds
        limit,
        ...(pageParam && { since: pageParam }), // Use since for better pagination
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

        // Filter valid video events
        let validEvents = events.filter(validateVideoEvent);

        // Filter by orientation if specified
        if (orientation !== 'all') {
          validEvents = validEvents.filter(event => {
            // Check for orientation in tags or content
            const hasVerticalTag = event.tags.some(([name, value]) => 
              name === 'orientation' && value === 'vertical'
            );
            const hasHorizontalTag = event.tags.some(([name, value]) => 
              name === 'orientation' && value === 'horizontal'
            );
            const contentHasVertical = event.content.toLowerCase().includes('vertical');
            const contentHasHorizontal = event.content.toLowerCase().includes('horizontal');

            if (orientation === 'vertical') {
              return hasVerticalTag || (!hasHorizontalTag && contentHasVertical);
            } else {
              return hasHorizontalTag || (!hasVerticalTag && contentHasHorizontal);
            }
          });
        }

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
          nextCursor: sortedEvents.length > 0 ? Math.min(...sortedEvents.map(e => e.created_at)) - 1 : undefined,
        };
      } catch (error) {
        console.error('Error in optimized video posts query:', error);
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

export function useOptimizedFollowingAllVideoPosts(followingPubkeys: string[], orientation: 'vertical' | 'horizontal' | 'all' = 'vertical') {
  return useOptimizedFeedLoader({
    feedType: 'videos',
    queryKey: ['optimized-following-all-video-posts', followingPubkeys.slice(0, 10), orientation], // Limit key size
    queryFn: async ({ limit, pageParam, signal, followingPubkeys: pubkeys }) => {
      if (pubkeys.length === 0) {
        return { events: [], nextCursor: undefined };
      }

      const filter = {
        kinds: [22, 34236], // Video event kinds
        authors: pubkeys,
        limit,
        ...(pageParam && { since: pageParam }), // Use since for better pagination
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

        // Filter valid video events
        let validEvents = events.filter(validateVideoEvent);

        // Filter by orientation if specified
        if (orientation !== 'all') {
          validEvents = validEvents.filter(event => {
            const hasVerticalTag = event.tags.some(([name, value]) => 
              name === 'orientation' && value === 'vertical'
            );
            const hasHorizontalTag = event.tags.some(([name, value]) => 
              name === 'orientation' && value === 'horizontal'
            );
            const contentHasVertical = event.content.toLowerCase().includes('vertical');
            const contentHasHorizontal = event.content.toLowerCase().includes('horizontal');

            if (orientation === 'vertical') {
              return hasVerticalTag || (!hasHorizontalTag && contentHasVertical);
            } else {
              return hasHorizontalTag || (!hasVerticalTag && contentHasHorizontal);
            }
          });
        }

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
          nextCursor: sortedEvents.length > 0 ? Math.min(...sortedEvents.map(e => e.created_at)) - 1 : undefined,
        };
      } catch (error) {
        console.error('Error in optimized following video posts query:', error);
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