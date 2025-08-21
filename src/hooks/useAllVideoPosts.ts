import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import type { NostrEvent, NostrFilter } from "@nostrify/nostrify";
import { useNostr } from '@nostrify/react';
import { useOutboxModel } from './useOutboxModel';
import { getDiscoveryPool } from "@/lib/poolManager";
import { useDeletedEvents, filterDeletedEvents } from './useDeletedEvents';

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
      const mimeMatch = tagContent.match(/(?:^|\s)m\s+(video\/\S+|application\/x-mpegURL)/);
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
      const hasVideoMime = tagContent.includes("m video/") || /m\s+video\//.test(tagContent);
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



export function useAllVideoPosts(hashtag?: string, location?: string, orientation?: 'vertical' | 'horizontal' | 'all') {
  const { data: deletionData } = useDeletedEvents();
  
  return useInfiniteQuery({
    queryKey: ["all-video-posts", hashtag, location, orientation],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
      const discoveryPool = getDiscoveryPool();

      const filter: {
        kinds: number[];
        limit: number;
        "#t"?: string[];
        until?: number;
      } = {
        kinds: [22, 34236], // Vertical video events only (NIP-71 short-form + legacy)
        limit: 20,
      };

      if (hashtag) {
        filter["#t"] = [hashtag];
      }

      if (pageParam) {
        filter.until = pageParam;
      }

      try {
        const events = await discoveryPool.query([filter], { signal: querySignal });
        
        // DEBUG: Check global feed for our specific events
        console.log(`GLOBAL FEED DEBUG: Found ${events.length} total events`);
        const kind22Events = events.filter(e => e.kind === 22);
        console.log(`GLOBAL FEED DEBUG: Found ${kind22Events.length} kind 22 events`);
        
        // Look for our specific user's events
        const userEvents = kind22Events.filter(e => e.pubkey === '3f770d65ad708627520e038003e2acdb865a6a5c73061b49eb8a4c41fb2d8d4b');
        console.log(`GLOBAL FEED DEBUG: Found ${userEvents.length} events from user 3f770d65`);
        
        if (userEvents.length > 0) {
          console.log('GLOBAL FEED DEBUG: User events found:', userEvents.map(e => ({
            id: e.id.slice(0, 8),
            content: e.content.slice(0, 30) + '...',
            created_at: e.created_at,
            timestamp: new Date(e.created_at * 1000).toISOString(),
            passesValidation: validateVideoEvent(e)
          })));
        }
        
        let validEvents = events.filter(validateVideoEvent);
        console.log(`GLOBAL FEED DEBUG: ${validEvents.length} events passed validation out of ${events.length} total`);

        // Filter by location if specified
        if (location) {
          validEvents = validEvents.filter(event =>
            event.tags.some(tag =>
              tag[0] === "location" &&
              tag[1] &&
              tag[1].toLowerCase().includes(location.toLowerCase())
            )
          );
        }

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
      } catch (error) {
        throw error;
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30000,
    refetchInterval: false, // Disable automatic refetching to prevent constant refreshing
    retry: 2, // Reduce retry attempts
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    maxPages: 20, // Limit to 20 pages (400 posts) to prevent memory issues
    gcTime: 2 * 60 * 1000, // Clean up after 2 minutes instead of default
  });
}

export function useFollowingAllVideoPosts(followingPubkeys: string[], orientation?: 'vertical' | 'horizontal' | 'all') {
  const { nostr } = useNostr();
  const { routeRequest } = useOutboxModel();
  const { data: deletionData } = useDeletedEvents();

  // Create a stable query key by sorting and stringifying the pubkeys array
  const stableFollowingKey = followingPubkeys.length > 0 ? followingPubkeys.slice().sort().join(',') : 'empty';

  return useInfiniteQuery({
    queryKey: ["following-all-video-posts", stableFollowingKey, orientation],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(15000)]); // Increased timeout for outbox routing

      // If no following pubkeys, return empty result
      if (followingPubkeys.length === 0) {
        return {
          events: [],
          nextCursor: undefined,
        };
      }

      // Fallback relays in case outbox model fails
      const fallbackRelays = [
        "wss://relay.nostr.band",
        "wss://relay.damus.io",
        "wss://relay.primal.net",
        "wss://nos.lol",
        "wss://relay.snort.social",
      ];

      try {
        const filter: {
          kinds: number[];
          authors: string[];
          limit: number;
          until?: number;
        } = {
          kinds: [22, 34236], // Vertical video events only (NIP-71 short-form + legacy)
          authors: followingPubkeys.slice(), // Create a copy to avoid reference issues
          limit: 15, // Slightly larger limit for outbox model
        };

        // Add pagination using 'until' timestamp
        if (pageParam) {
          filter.until = pageParam;
        }

        // Use outbox model to route requests to followed users' write relays
        let relayMap: Map<string, NostrFilter[]>;
        try {
          relayMap = await routeRequest([filter], fallbackRelays);
        } catch (outboxError) {
          // Fallback to discovery pool if outbox model fails
          const discoveryPool = getDiscoveryPool();
          const events = await discoveryPool.query([filter], { signal: querySignal });
          const validEvents = events.filter(validateVideoEvent);
          const uniqueEvents = validEvents.filter(
            (event, index, self) => index === self.findIndex((e) => e.id === event.id)
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

        const validEvents = events.filter(validateVideoEvent);

        // Deduplicate by ID first, then sort by created_at
        const uniqueEvents = validEvents.filter(
          (event, index, self) => index === self.findIndex((e) => e.id === event.id)
        );

        const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);

        // Filter out deleted events if deletion data is available
        const filteredEvents = deletionData 
          ? filterDeletedEvents(sortedEvents, deletionData.deletedEventIds, deletionData.deletedEventCoordinates)
          : sortedEvents;


        return {
          events: filteredEvents,
          nextCursor:
            filteredEvents.length > 0
              ? filteredEvents[filteredEvents.length - 1].created_at
              : undefined,
        };
      } catch (error) {
        throw error;
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: followingPubkeys.length > 0, // Only run query if we have pubkeys to follow
    staleTime: 30000, // 30 seconds
    refetchInterval: false, // Disable automatic refetching to prevent constant refreshing
    retry: 3, // Increased retry attempts for outbox model
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
    maxPages: 20, // Limit to 20 pages for following feed
    gcTime: 3 * 60 * 1000, // Clean up after 3 minutes
  });
}

export function useHashtagAllVideoPosts(hashtags: string[], limit = 3, orientation?: 'vertical' | 'horizontal' | 'all') {
  const { data: deletionData } = useDeletedEvents();
  
  return useQuery({
    queryKey: ["hashtag-all-video-posts", hashtags, limit, orientation],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Use shared discovery pool to avoid creating more connections
      const discoveryPool = getDiscoveryPool();

      // Hashtag feeds use discovery relays only (no outbox model)
      // Query for each hashtag
      const hashtagResults = await Promise.all(
        hashtags.map(async (hashtag) => {
          const events = await discoveryPool.query(
            [
              {
                kinds: [22, 34236], // Vertical video events only (NIP-71 short-form + legacy)
                "#t": [hashtag],
                limit,
              },
            ],
            { signal }
          );

          const validEvents = events.filter(validateVideoEvent);

          // All videos are vertical by design (kind 22 and 34236 are vertical-only)
          
          const sortedEvents = validEvents.sort((a, b) => b.created_at - a.created_at);
          
          // Filter out deleted events if deletion data is available
          const filteredEvents = deletionData 
            ? filterDeletedEvents(sortedEvents, deletionData.deletedEventIds, deletionData.deletedEventCoordinates)
            : sortedEvents;

          return {
            hashtag,
            posts: filteredEvents,
          };
        })
      );

      return hashtagResults;
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
  });
}