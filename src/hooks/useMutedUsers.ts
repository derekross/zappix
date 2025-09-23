import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';

export function useMutedUsers() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['muted-users', user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) {
        return [];
      }

      try {
        const timeoutSignal = AbortSignal.timeout(3000);
        const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

        // Query for mute list (kind 10000)
        const events = await nostr.query(
          [{
            kinds: [10000],
            authors: [user.pubkey],
            limit: 1
          }],
          { signal: combinedSignal }
        );

        const muteListEvent = events[0];
        if (!muteListEvent) {
          return [];
        }

        // Extract muted pubkeys from 'p' tags
        const mutedPubkeys = muteListEvent.tags
          .filter(([tagName]) => tagName === 'p')
          .map(([, pubkey]) => pubkey)
          .filter(Boolean);

        return mutedPubkeys;
      } catch (error) {
        console.warn('Failed to load muted users:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!user?.pubkey,
  });
}