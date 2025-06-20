import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

export function useAuthors(pubkeys: string[]) {
  const { nostr } = useNostr();

  return useQuery<Record<string, { event?: NostrEvent; metadata?: NostrMetadata }>>({
    queryKey: ['authors', ...pubkeys.sort()],
    queryFn: async ({ signal }) => {
      if (pubkeys.length === 0) {
        return {};
      }

      // Use a longer timeout for batch queries - they need more time
      const timeoutSignal = AbortSignal.timeout(10000);
      const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

      const result: Record<string, { event?: NostrEvent; metadata?: NostrMetadata }> = {};

      // Initialize all pubkeys with empty objects
      for (const pubkey of pubkeys) {
        result[pubkey] = {};
      }

      try {
        // Batch query for all profile metadata
        const events = await nostr.query(
          [{ kinds: [0], authors: pubkeys, limit: pubkeys.length }],
          { signal: combinedSignal }
        );

        // Process found events
        for (const event of events) {
          try {
            const metadata = n.json().pipe(n.metadata()).parse(event.content);
            result[event.pubkey] = { metadata, event };
          } catch {
            result[event.pubkey] = { event };
          }
        }

        return result;
      } catch (error) {
        console.warn(`Failed to load profiles for ${pubkeys.length} authors:`, error);
        // Return empty objects for all pubkeys on error - don't fail completely
        return result;
      }
    },
    enabled: pubkeys.length > 0,
    retry: 1, // Reduce retries for batch queries
    retryDelay: 2000, // Fixed delay
    staleTime: 30 * 60 * 1000, // 30 minutes - longer for batch queries
    gcTime: 2 * 60 * 60 * 1000, // 2 hours - keep batch data longer
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false, // Don't refetch if we have cached data
    // Don't block other queries if this one fails
    throwOnError: false,
  });
}