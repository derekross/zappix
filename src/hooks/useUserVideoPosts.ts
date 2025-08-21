import { useInfiniteQuery } from '@tanstack/react-query';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { getDiscoveryPool } from "@/lib/poolManager";
import { useDeletedEvents, filterDeletedEvents } from './useDeletedEvents';
import { useOutboxModel } from './useOutboxModel';
import { useNostr } from '@nostrify/react';

// Validator function for vertical video events (NIP-71 kind 22 and legacy kind 34236)
function validateVideoEvent(event: NostrEvent): boolean {
  // Check for NIP-71 short-form video events (kind 22)
  if (event.kind === 22) {
    // For NIP-71 video events, check for imeta tag with video content
    const imetaTags = event.tags.filter(([name]) => name === "imeta");

    // Check if any imeta tag contains video content
    const hasVideoImeta = imetaTags.some(tag => {
      // Handle multiple formats more flexibly
      let hasUrl = false;
      let hasVideoMime = false;
      
      // Join all tag elements after the first one to create content string
      const tagContent = tag.slice(1).join(" ");
      
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
    return hasVideoImeta || hasVideoUrl;
  }

  // Check for legacy vertical video events (kind 34236)
  if (event.kind === 34236) {
    // For legacy kind 34236, check for imeta tag with video content
    const imetaTags = event.tags.filter(([name]) => name === "imeta");

    // Check if any imeta tag contains video content
    const hasVideoImeta = imetaTags.some(tag => {
      const tagContent = tag.slice(1).join(" ");
      const hasUrl = tagContent.includes("url ") || /url\s+\S+/.test(tagContent);
      const hasVideoMime = tagContent.includes("m video/") || /\bm\s+video\//.test(tagContent);
      return hasUrl && hasVideoMime;
    });

    // Also check for standalone m and x tags (legacy format)
    const hasMimeTag = event.tags.some(([name, value]) => name === "m" && value?.startsWith("video/"));
    const hasHashTag = event.tags.some(([name]) => name === "x");

    // Check for simple URL tags as additional fallback
    const hasVideoUrl = event.tags.some(([name, value]) => {
      if (name !== 'url') return false;
      if (!value) return false;
      return /\.(mp4|webm|mov|avi|mkv|3gp|m4v)$/i.test(value) || 
             value.includes('video');
    });

    return hasVideoImeta || (hasMimeTag && hasHashTag) || hasVideoUrl;
  }

  return false;
}

// Pool management is now centralized in poolManager.ts

export function useUserVideoPosts(pubkey: string) {
  const { data: deletionData } = useDeletedEvents();
  const { routeRequest } = useOutboxModel();
  const { nostr } = useNostr();
  
  return useInfiniteQuery({
    queryKey: ['user-video-posts', pubkey],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
      
      // Fallback relays in case outbox model fails
      const fallbackRelays = [
        "wss://relay.nostr.band",
        "wss://relay.damus.io", 
        "wss://relay.primal.net",
        "wss://nos.lol",
        "wss://relay.snort.social",
      ];

      const filter: {
        kinds: number[];
        authors: string[];
        limit: number;
        until?: number;
      } = {
        kinds: [22, 34236], // Video event kinds
        authors: [pubkey],
        limit: 20,
      };

      if (pageParam) {
        filter.until = pageParam;
      }

      // Use outbox model to route requests to user's write relays
      let relayMap: Map<string, NostrFilter[]>;
      try {
        relayMap = await routeRequest([filter], fallbackRelays);
      } catch (outboxError) {
        // Fallback to discovery pool if outbox model fails
        const discoveryPool = getDiscoveryPool();
        const events = await discoveryPool.query([filter], { signal: querySignal });
        const validEvents = events.filter(validateVideoEvent);
        const uniqueEvents = validEvents.filter(
          (event, index, self) => index === self.findIndex(e => e.id === event.id)
        );
        const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);

        // Filter out deleted events if deletion data is available
        const filteredEvents = deletionData 
          ? filterDeletedEvents(sortedEvents, deletionData.deletedEventIds, deletionData.deletedEventCoordinates)
          : sortedEvents;

        return {
          events: filteredEvents,
          nextCursor: filteredEvents.length > 0 ? filteredEvents[filteredEvents.length - 1].created_at : undefined,
        };
      }

      // Query all routed relays
      const relayPromises = Array.from(relayMap.entries()).map(async ([relay, filters]) => {
        try {
          const events = await nostr.query(filters, { signal: querySignal });
          return events;
        } catch (error) {
          return []; // Return empty array on failure
        }
      });

      const allEvents = await Promise.all(relayPromises);
      const events = allEvents.flat();

      // If outbox model returned no results, try fallback to discovery relays  
      if (events.length === 0) {
        try {
          const discoveryPool = getDiscoveryPool();
          const fallbackEvents = await discoveryPool.query([filter], { signal: querySignal });
          events.push(...fallbackEvents);
        } catch (fallbackError) {
          // Fallback failed, continue with empty results
        }
      }

      // DEBUG: Look for the most recent events
      const kind22Events = events.filter(e => e.kind === 22);
      const sortedByTime = kind22Events.sort((a, b) => b.created_at - a.created_at);
      
      console.log(`PROFILE DEBUG: Query found ${events.length} total events, ${kind22Events.length} kind 22 events for pubkey ${pubkey.slice(0,8)}`);
      console.log('PROFILE DEBUG: Most recent 3 kind 22 events:', sortedByTime.slice(0, 3).map(e => ({
        id: e.id.slice(0, 8),
        created_at: e.created_at,
        timestamp: new Date(e.created_at * 1000).toISOString(),
        content: e.content.slice(0, 40) + '...',
        passesValidation: validateVideoEvent(e)
      })));

      // Filter and validate video events
      const validEvents = events.filter(validateVideoEvent);
      
      console.log(`PROFILE DEBUG: ${validEvents.length} events passed validation`);

      // Deduplicate by ID first, then sort by created_at
      const uniqueEvents = validEvents.filter(
        (event, index, self) => index === self.findIndex(e => e.id === event.id)
      );

      const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);

      // Filter out deleted events if deletion data is available
      const filteredEvents = deletionData 
        ? filterDeletedEvents(sortedEvents, deletionData.deletedEventIds, deletionData.deletedEventCoordinates)
        : sortedEvents;

      return {
        events: filteredEvents,
        nextCursor: filteredEvents.length > 0 ? filteredEvents[filteredEvents.length - 1].created_at : undefined,
      };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30000, // 30 seconds for better development experience 
    enabled: !!pubkey,
  });
}