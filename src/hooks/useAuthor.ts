import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { profileCache } from '@/lib/profileCache';

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
      }

      // Check localStorage cache first for instant loading
      const cached = profileCache.get(pubkey);

      // If we have a fresh cache (< 1 hour old), return it without fetching
      if (cached && !profileCache.needsRefresh(pubkey)) {
        return { metadata: cached };
      }

      // Shorter timeout for faster loading - profiles should load quickly
      const timeoutSignal = AbortSignal.timeout(3000);
      const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

      try {
        // Query for profile metadata
        const events = await nostr.query(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          { signal: combinedSignal }
        );

        const event = events[0];
        if (!event) {
          // If we have stale cache but network failed, return stale data
          if (cached) {
            return { metadata: cached };
          }
          return {};
        }

        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);

          // Save to localStorage cache
          profileCache.set(pubkey, metadata);

          return { metadata, event };
        } catch {
          // If we have stale cache but parsing failed, return stale data
          if (cached) {
            return { metadata: cached };
          }
          return { event };
        }
      } catch {
        // If network fails but we have cached data, return it
        if (cached) {
          return { metadata: cached };
        }
        return {};
      }
    },
    // Use cached data as initial data for instant loading
    initialData: () => {
      if (!pubkey) return undefined;
      const cached = profileCache.get(pubkey);
      if (cached) {
        return { metadata: cached };
      }
      return undefined;
    },
    // Mark initial data as stale if it needs refresh
    initialDataUpdatedAt: () => {
      if (!pubkey) return undefined;
      if (profileCache.needsRefresh(pubkey)) {
        return 0; // Mark as stale to trigger background refetch
      }
      return Date.now();
    },
    retry: 1,
    retryDelay: 2000,
    staleTime: 60 * 60 * 1000, // 1 hour - rely more on localStorage cache
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    throwOnError: false,
  });
}
