import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { profileCache } from '@/lib/profileCache';

export function useAuthors(pubkeys: string[]) {
  const { nostr } = useNostr();

  return useQuery<Record<string, { event?: NostrEvent; metadata?: NostrMetadata }>>({
    queryKey: ['authors', ...pubkeys.sort()],
    queryFn: async ({ signal }) => {
      if (pubkeys.length === 0) {
        return {};
      }

      const result: Record<string, { event?: NostrEvent; metadata?: NostrMetadata }> = {};

      // Check localStorage cache first and build result with cached data
      const cachedProfiles = profileCache.getMultiple(pubkeys);
      const uncachedPubkeys: string[] = [];

      for (const pubkey of pubkeys) {
        const cached = cachedProfiles.get(pubkey);
        if (cached && !profileCache.needsRefresh(pubkey)) {
          result[pubkey] = { metadata: cached };
        } else {
          uncachedPubkeys.push(pubkey);
          result[pubkey] = cached ? { metadata: cached } : {};
        }
      }

      // If all profiles are cached and fresh, return immediately
      if (uncachedPubkeys.length === 0) {
        return result;
      }

      // Use a longer timeout for batch queries - they need more time
      const timeoutSignal = AbortSignal.timeout(10000);
      const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

      try {
        // Batch query for uncached profile metadata
        const events = await nostr.query(
          [{ kinds: [0], authors: uncachedPubkeys, limit: uncachedPubkeys.length }],
          { signal: combinedSignal }
        );

        // Process found events and cache them
        const newProfiles = new Map<string, NostrMetadata>();
        for (const event of events) {
          try {
            const metadata = n.json().pipe(n.metadata()).parse(event.content);
            result[event.pubkey] = { metadata, event };
            newProfiles.set(event.pubkey, metadata);
          } catch {
            result[event.pubkey] = { event };
          }
        }

        // Save new profiles to localStorage cache
        if (newProfiles.size > 0) {
          profileCache.setMultiple(newProfiles);
        }

        return result;
      } catch {
        // Return what we have (including stale cached data) on error
        return result;
      }
    },
    // Use cached data as initial data for instant loading
    initialData: () => {
      if (pubkeys.length === 0) return undefined;
      const cachedProfiles = profileCache.getMultiple(pubkeys);
      if (cachedProfiles.size === 0) return undefined;

      const result: Record<string, { event?: NostrEvent; metadata?: NostrMetadata }> = {};
      let hasAnyData = false;
      for (const pubkey of pubkeys) {
        const cached = cachedProfiles.get(pubkey);
        if (cached) {
          result[pubkey] = { metadata: cached };
          hasAnyData = true;
        } else {
          result[pubkey] = {};
        }
      }
      return hasAnyData ? result : undefined;
    },
    enabled: pubkeys.length > 0,
    retry: 1,
    retryDelay: 2000,
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    throwOnError: false,
  });
}