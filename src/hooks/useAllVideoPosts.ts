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
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]); // Faster timeout
      const discoveryPool = getDiscoveryPool();

      const filter: {
        kinds: number[];
        limit: number;
        "#t"?: string[];
        until?: number;
      } = {
        kinds: [22, 34236], // Vertical video events only (NIP-71 short-form + legacy)
        limit: 10, // Smaller page size for faster video loading
      };

      if (hashtag) {
        filter["#t"] = [hashtag];
      }

      if (pageParam) {
        filter.until = pageParam;
      }

      const events = await discoveryPool.query([filter], { signal: querySignal });

      let validEvents = events.filter(validateVideoEvent);

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
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60000, // 1 minute
    refetchInterval: false, // Disable automatic refetching to prevent constant refreshing
    retry: 1, // Single retry for faster response
    retryDelay: 1000, // Fixed 1 second retry delay
    maxPages: 15, // Limit to 15 pages (150 posts) to prevent memory issues
    gcTime: 3 * 60 * 1000, // Clean up after 3 minutes
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
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(6000)]); // Faster timeout for following feed

      // If no following pubkeys, return empty result
      if (followingPubkeys.length === 0) {
        console.log('❌ No following pubkeys, returning empty result');
        return {
          events: [],
          nextCursor: undefined,
        };
      }

      console.log(`🔍 Following video query - ${followingPubkeys.length} authors, pageParam: ${pageParam}`);

      // Fallback relays - using fewer, faster relays
      const fallbackRelays = [
        "wss://relay.nostr.band",
        "wss://relay.primal.net",
        "wss://nos.lol",
      ];

      // Chunk authors to avoid relay limits (max 500 authors per query)
      const maxAuthorsPerQuery = 500;
      const authorChunks = [];
      for (let i = 0; i < followingPubkeys.length; i += maxAuthorsPerQuery) {
        authorChunks.push(followingPubkeys.slice(i, i + maxAuthorsPerQuery));
      }

      console.log(`📦 Split ${followingPubkeys.length} authors into ${authorChunks.length} chunks`);

      // Query each chunk and combine results
      const allEvents: NostrEvent[] = [];
      
      for (const [chunkIndex, authorChunk] of authorChunks.entries()) {
        console.log(`🔄 Querying chunk ${chunkIndex + 1}/${authorChunks.length} with ${authorChunk.length} authors`);

        const filter: {
          kinds: number[];
          authors: string[];
          limit: number;
          until?: number;
        } = {
          kinds: [22, 34236], // Vertical video events only (NIP-71 short-form + legacy)
          authors: authorChunk,
          limit: Math.ceil(10 / authorChunks.length), // Distribute limit across chunks
        };

        // Add pagination using 'until' timestamp
        if (pageParam) {
          filter.until = pageParam;
        }

        try {
          // Use discovery pool directly for better reliability with large author lists
          const discoveryPool = getDiscoveryPool();
          const chunkEvents = await discoveryPool.query([filter], { signal: querySignal });
          console.log(`📥 Chunk ${chunkIndex + 1} returned ${chunkEvents.length} raw events`);
          allEvents.push(...chunkEvents);
        } catch (error) {
          console.error(`❌ Error querying chunk ${chunkIndex + 1}:`, error);
        }
      }

      console.log(`📊 Total raw events from all chunks: ${allEvents.length}`);

      const validEvents = allEvents.filter(validateVideoEvent);
      console.log(`✅ Valid video events after filtering: ${validEvents.length}`);

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
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: followingPubkeys.length > 0, // Only run query if we have pubkeys to follow
    staleTime: 60000, // 1 minute
    refetchInterval: false, // Disable automatic refetching to prevent constant refreshing
    retry: 1, // Single retry for faster response
    retryDelay: 1000, // Fixed 1 second retry delay
    maxPages: 15, // Limit to 15 pages for following feed
    gcTime: 5 * 60 * 1000, // Clean up after 5 minutes for following feed
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