import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

// Validator function for NIP-25 reaction events
function validateReactionEvent(event: NostrEvent): boolean {
  if (event.kind !== 7) return false;

  // Must have an 'e' tag pointing to the reacted event
  const eTag = event.tags.find(([name]) => name === 'e');
  if (!eTag || !eTag[1]) return false;

  // Should have a 'p' tag pointing to the author of the reacted event
  const pTag = event.tags.find(([name]) => name === 'p');
  if (!pTag || !pTag[1]) return false;

  return true;
}

export function useReactions(eventId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['reactions', eventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      const events = await nostr.query([{ 
        kinds: [7], 
        '#e': [eventId],
        limit: 100 
      }], { signal });
      
      const validReactions = events.filter(validateReactionEvent);
      
      // Group reactions by content (emoji/reaction type)
      const reactionCounts = validReactions.reduce((acc, reaction) => {
        const content = reaction.content || '+'; // Default to like if empty
        if (!acc[content]) {
          acc[content] = {
            count: 0,
            users: [],
            hasReacted: false
          };
        }
        acc[content].count++;
        acc[content].users.push(reaction.pubkey);
        
        // Check if current user has reacted
        if (user && reaction.pubkey === user.pubkey) {
          acc[content].hasReacted = true;
        }
        
        return acc;
      }, {} as Record<string, { count: number; users: string[]; hasReacted: boolean }>);

      return reactionCounts;
    },
    staleTime: 30000,
  });
}

export function useReactToPost() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, authorPubkey, reaction = '+' }: { 
      eventId: string; 
      authorPubkey: string; 
      reaction?: string;
    }) => {
      if (!user?.signer) throw new Error('User not logged in');

      const event = await user.signer.signEvent({
        kind: 7,
        content: reaction,
        tags: [
          ['e', eventId],
          ['p', authorPubkey],
          ['k', '20'] // Reacting to kind 20 (image post)
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event);
      return event;
    },
    onSuccess: (_, variables) => {
      // Invalidate reactions query to refetch
      queryClient.invalidateQueries({ queryKey: ['reactions', variables.eventId] });
    },
  });
}