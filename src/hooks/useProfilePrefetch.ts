import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { profileCache } from '@/lib/profileCache';

/**
 * Hook for intelligently prefetching profiles based on visible content
 */
export function useProfilePrefetch() {
  const queryClient = useQueryClient();
  const { nostr } = useNostr();
  const prefetchQueueRef = useRef<Set<string>>(new Set());
  const prefetchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Prefetch profiles in batches and populate both localStorage and React Query caches
   */
  const prefetchProfilesBatch = useCallback(async (pubkeys: string[]) => {
    if (pubkeys.length === 0) return;

    try {
      // Use a shorter timeout for prefetch to not block other operations
      const signal = AbortSignal.timeout(5000);

      // Batch query for all profiles
      const events = await nostr.query(
        [{ kinds: [0], authors: pubkeys, limit: pubkeys.length }],
        { signal }
      );

      // Process and cache individual profiles
      const newProfiles = new Map<string, NostrMetadata>();

      events.forEach(event => {
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          newProfiles.set(event.pubkey, metadata);
          // Also update React Query cache for immediate availability
          queryClient.setQueryData(['author', event.pubkey], { metadata, event });
        } catch {
          // Skip invalid profiles
        }
      });

      // Save to localStorage cache
      if (newProfiles.size > 0) {
        profileCache.setMultiple(newProfiles);
      }
    } catch {
      // Silent fail for prefetch - it's not critical
    }
  }, [nostr, queryClient]);

  /**
   * Add pubkeys to the prefetch queue
   */
  const queueProfilePrefetch = useCallback((pubkeys: string[]) => {
    // Filter out already cached profiles using localStorage cache
    const uncachedPubkeys = profileCache.getMissingPubkeys(pubkeys);

    if (uncachedPubkeys.length === 0) return;

    // Add to queue
    uncachedPubkeys.forEach(pubkey => prefetchQueueRef.current.add(pubkey));

    // Debounce the actual prefetch to batch requests
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
    }

    prefetchTimeoutRef.current = setTimeout(() => {
      const queuedPubkeys = Array.from(prefetchQueueRef.current);
      if (queuedPubkeys.length > 0) {
        prefetchProfilesBatch(queuedPubkeys);
        prefetchQueueRef.current.clear();
      }
    }, 100); // 100ms debounce
  }, [prefetchProfilesBatch]);

  /**
   * Prefetch profiles for a list of events (extracts authors)
   */
  const prefetchProfilesForEvents = (events: NostrEvent[]) => {
    const authorPubkeys = [...new Set(events.map(event => event.pubkey))];
    queueProfilePrefetch(authorPubkeys);
  };

  /**
   * Prefetch profiles for notifications (extracts authors from notification events)
   */
  const prefetchProfilesForNotifications = (notifications: Array<{ event: NostrEvent; targetEvent?: NostrEvent }>) => {
    const pubkeys = new Set<string>();
    
    notifications.forEach(notification => {
      pubkeys.add(notification.event.pubkey);
      if (notification.targetEvent) {
        pubkeys.add(notification.targetEvent.pubkey);
      }
    });

    queueProfilePrefetch(Array.from(pubkeys));
  };

  /**
   * Prefetch profiles for comments (extracts authors)
   */
  const prefetchProfilesForComments = (comments: NostrEvent[]) => {
    const authorPubkeys = [...new Set(comments.map(comment => comment.pubkey))];
    queueProfilePrefetch(authorPubkeys);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }
    };
  }, []);

  return {
    queueProfilePrefetch,
    prefetchProfilesForEvents,
    prefetchProfilesForNotifications,
    prefetchProfilesForComments,
  };
}

/**
 * Hook that automatically prefetches profiles when data changes
 */
export function useAutomaticProfilePrefetch<T extends { pubkey: string } | NostrEvent>(
  data: T[] | undefined,
  enabled = true
) {
  const { queueProfilePrefetch } = useProfilePrefetch();
  const prevDataRef = useRef<T[]>();

  useEffect(() => {
    if (!enabled || !data || data === prevDataRef.current) return;

    const pubkeys = data.map(item => 'pubkey' in item ? item.pubkey : (item as NostrEvent).pubkey);
    queueProfilePrefetch(pubkeys);
    
    prevDataRef.current = data;
  }, [data, enabled, queueProfilePrefetch]);
}