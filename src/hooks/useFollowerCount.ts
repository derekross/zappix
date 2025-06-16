import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

export function useFollowerCount(pubkey: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['follower-count', pubkey],
    queryFn: async (c) => {
      if (!pubkey) return 0;
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Query for contact lists (kind 3) that include this pubkey in their 'p' tags
      const contactEvents = await nostr.query([{ 
        kinds: [3],
        '#p': [pubkey],
        limit: 1000 // Limit to avoid too many results
      }], { signal });
      
      // Count unique authors (followers)
      const uniqueFollowers = new Set(contactEvents.map(event => event.pubkey));
      
      return uniqueFollowers.size;
    },
    enabled: !!pubkey,
    staleTime: 300000, // 5 minutes
    refetchInterval: 300000, // Refetch every 5 minutes
  });
}