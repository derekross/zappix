import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
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
          return {};
        }

        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          return { metadata, event };
        } catch {
          return { event };
        }
      } catch (error) {
        console.warn(`Failed to load profile for ${pubkey}:`, error);
        return {};
      }
    },
    retry: 1, // Reduce retries to prevent blocking
    retryDelay: 2000, // Fixed 2 second delay
    staleTime: 30 * 60 * 1000, // 30 minutes - much longer for profiles
    gcTime: 2 * 60 * 60 * 1000, // 2 hours - keep profiles in memory longer
    // Minimal background refetching for better performance
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false, // Don't refetch if we have cached data
    // Don't block other queries if this one fails
    throwOnError: false,
  });
}
