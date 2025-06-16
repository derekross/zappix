import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';


export function useBookmarks() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['bookmarks', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Get user's bookmark list (kind 10003)
      const bookmarkEvents = await nostr.query([{ 
        kinds: [10003], 
        authors: [user.pubkey],
        limit: 1 
      }], { signal });
      
      if (bookmarkEvents.length === 0) return [];
      
      const bookmarkList = bookmarkEvents[0];
      
      // Extract event IDs from 'e' tags
      const eventIds = bookmarkList.tags
        .filter(([name]) => name === 'e')
        .map(([, eventId]) => eventId)
        .filter(Boolean);
      
      if (eventIds.length === 0) return [];
      
      // Fetch the actual bookmarked events
      const events = await nostr.query([{ 
        ids: eventIds,
        kinds: [20], // Only image posts
        limit: 100 
      }], { signal });
      
      // Filter to only valid image events
      return events.filter(event => {
        const title = event.tags.find(([name]) => name === 'title')?.[1];
        const imeta = event.tags.find(([name]) => name === 'imeta');
        return title && imeta;
      }).sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!user?.pubkey,
    staleTime: 60000,
  });
}

export function useIsBookmarked(eventId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['is-bookmarked', eventId, user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return false;
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);
      
      const bookmarkEvents = await nostr.query([{ 
        kinds: [10003], 
        authors: [user.pubkey],
        limit: 1 
      }], { signal });
      
      if (bookmarkEvents.length === 0) return false;
      
      const bookmarkList = bookmarkEvents[0];
      return bookmarkList.tags.some(([name, id]) => name === 'e' && id === eventId);
    },
    enabled: !!user?.pubkey && !!eventId,
    staleTime: 30000,
  });
}

export function useToggleBookmark() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, isBookmarked }: { eventId: string; isBookmarked: boolean }) => {
      if (!user?.signer || !user?.pubkey) throw new Error('User not logged in');

      // Get current bookmark list
      const bookmarkEvents = await nostr.query([{ 
        kinds: [10003], 
        authors: [user.pubkey],
        limit: 1 
      }]);
      
      let currentTags: string[][] = [];
      
      if (bookmarkEvents.length > 0) {
        currentTags = bookmarkEvents[0].tags;
      }
      
      let newTags: string[][];
      
      if (isBookmarked) {
        // Remove bookmark
        newTags = currentTags.filter(([name, id]) => !(name === 'e' && id === eventId));
      } else {
        // Add bookmark
        newTags = [...currentTags, ['e', eventId]];
      }
      
      const event = await user.signer.signEvent({
        kind: 10003,
        content: '',
        tags: newTags,
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event);
      return event;
    },
    onSuccess: (_, variables) => {
      // Invalidate bookmark queries
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['is-bookmarked', variables.eventId] });
    },
  });
}