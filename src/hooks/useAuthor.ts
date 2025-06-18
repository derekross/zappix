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

      // Use a reasonable timeout for reliable loading
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
      } catch {
        return {};
      }
    },
    retry: 1, // Allow one retry for reliability
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    // Reduce background refetching but keep some for reliability
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}
