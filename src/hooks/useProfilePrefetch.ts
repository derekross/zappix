import { useEffect, useRef } from 'react';
import { useProfileCache } from './useProfileCache';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';

/**
 * Hook for intelligently prefetching profiles based on visible content
 */
export function useProfilePrefetch() {
  const { prefetchProfiles, isProfileCached } = useProfileCache();
  const queryClient = useQueryClient();
  const { nostr } = useNostr();
  const prefetchQueueRef = useRef<Set<string>>(new Set());
  const prefetchTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Add pubkeys to the prefetch queue
   */
  const queueProfilePrefetch = (pubkeys: string[]) => {
    // Filter out already cached profiles
    const uncachedPubkeys = pubkeys.filter(pubkey => !isProfileCached(pubkey));
    
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
  };

  /**
   * Prefetch profiles in batches and populate individual caches
   */
  const prefetchProfilesBatch = async (pubkeys: string[]) => {
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
      const profileData: Record<string, { event?: NostrEvent; metadata?: NostrMetadata }> = {};

      // Initialize all pubkeys with empty objects
      pubkeys.forEach(pubkey => {
        profileData[pubkey] = {};
      });

      // Process found events
      events.forEach(event => {
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          profileData[event.pubkey] = { metadata, event };
        } catch {
          profileData[event.pubkey] = { event };
        }
      });

      // Cache individual profiles
      Object.entries(profileData).forEach(([pubkey, data]) => {
        queryClient.setQueryData(['author', pubkey], data);
      });

      if (import.meta.env.DEV) {
        console.log(`Prefetched ${events.length}/${pubkeys.length} profiles`);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Profile prefetch failed:', error);
      }
    }
  };

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