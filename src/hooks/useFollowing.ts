import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';


export function useFollowing() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['following', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Get user's contact list (kind 3)
      const contactEvents = await nostr.query([{ 
        kinds: [3], 
        authors: [user.pubkey],
        limit: 1 
      }], { signal });
      
      if (contactEvents.length === 0) return [];
      
      const contactList = contactEvents[0];
      
      // Extract pubkeys from 'p' tags
      const followingPubkeys = contactList.tags
        .filter(([name]) => name === 'p')
        .map(([, pubkey]) => pubkey)
        .filter(Boolean);
      
      return followingPubkeys;
    },
    enabled: !!user?.pubkey,
    staleTime: 60000,
  });
}

export function useIsFollowing(pubkey: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['is-following', pubkey, user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey || !pubkey) return false;
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);
      
      const contactEvents = await nostr.query([{ 
        kinds: [3], 
        authors: [user.pubkey],
        limit: 1 
      }], { signal });
      
      if (contactEvents.length === 0) return false;
      
      const contactList = contactEvents[0];
      return contactList.tags.some(([name, pk]) => name === 'p' && pk === pubkey);
    },
    enabled: !!user?.pubkey && !!pubkey,
    staleTime: 30000,
  });
}

export function useToggleFollow() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pubkey, isFollowing }: { pubkey: string; isFollowing: boolean }) => {
      if (!user?.signer || !user?.pubkey) throw new Error('User not logged in');

      // Get current contact list
      const contactEvents = await nostr.query([{ 
        kinds: [3], 
        authors: [user.pubkey],
        limit: 1 
      }]);
      
      let currentTags: string[][] = [];
      let currentContent = '';
      
      if (contactEvents.length > 0) {
        currentTags = contactEvents[0].tags;
        currentContent = contactEvents[0].content;
      }
      
      let newTags: string[][];
      
      if (isFollowing) {
        // Unfollow - remove the pubkey
        newTags = currentTags.filter(([name, pk]) => !(name === 'p' && pk === pubkey));
      } else {
        // Follow - add the pubkey
        newTags = [...currentTags, ['p', pubkey]];
      }
      
      const event = await user.signer.signEvent({
        kind: 3,
        content: currentContent,
        tags: newTags,
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event);
      return event;
    },
    onSuccess: (_, variables) => {
      // Invalidate following queries
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['is-following', variables.pubkey] });
    },
  });
}