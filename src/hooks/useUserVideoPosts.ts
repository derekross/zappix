import { useInfiniteQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
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