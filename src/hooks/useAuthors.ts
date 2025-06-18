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

      // Use a shorter timeout for faster loading
      const timeoutSignal = AbortSignal.timeout(2000);
      const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

      try {
        // Batch query for all profile metadata
        const events = await nostr.query(
          [{ kinds: [0], authors: pubkeys, limit: pubkeys.length }],
          { signal: combinedSignal }
        );

        const result: Record<string, { event?: NostrEvent; metadata?: NostrMetadata }> = {};

        // Initialize all pubkeys with empty objects
        for (const pubkey of pubkeys) {
          result[pubkey] = {};
        }

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
      } catch {
        // Return empty objects for all pubkeys on error
        const result: Record<string, { event?: NostrEvent; metadata?: NostrMetadata }> = {};
        for (const pubkey of pubkeys) {
          result[pubkey] = {};
        }
        return result;
      }
    },
    enabled: pubkeys.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}