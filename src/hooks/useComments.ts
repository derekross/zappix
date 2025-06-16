import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

// Validator function for NIP-22 comment events
function validateCommentEvent(event: NostrEvent): boolean {
  if (event.kind !== 1111) return false;

  // Must have uppercase tags for root scope
  const hasRootScope = event.tags.some(([name]) => ['E', 'A', 'I'].includes(name));
  if (!hasRootScope) return false;

  // Must have K tag for root kind
  const kTag = event.tags.find(([name]) => name === 'K');
  if (!kTag || !kTag[1]) return false;

  return true;
}

export function useComments(eventId: string, _authorPubkey: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['comments', eventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query([{ 
        kinds: [1111], 
        '#E': [eventId], // Comments on the root event
        limit: 100 
      }], { signal });
      
      const validComments = events.filter(validateCommentEvent);
      
      // Sort by creation time (oldest first for comments)
      return validComments.sort((a, b) => a.created_at - b.created_at);
    },
    staleTime: 30000,
  });
}

export function useCommentReplies(commentId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['comment-replies', commentId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      const events = await nostr.query([{ 
        kinds: [1111], 
        '#e': [commentId], // Replies to this comment
        limit: 50 
      }], { signal });
      
      const validReplies = events.filter(validateCommentEvent);
      
      return validReplies.sort((a, b) => a.created_at - b.created_at);
    },
    staleTime: 30000,
  });
}

export function useCreateComment() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      content, 
      rootEventId, 
      rootAuthorPubkey, 
      parentEventId, 
      parentAuthorPubkey 
    }: { 
      content: string;
      rootEventId: string;
      rootAuthorPubkey: string;
      parentEventId?: string;
      parentAuthorPubkey?: string;
    }) => {
      if (!user?.signer) throw new Error('User not logged in');

      const tags = [
        // Root scope tags (uppercase)
        ['E', rootEventId, '', rootAuthorPubkey],
        ['K', '20'], // Root kind is image post (kind 20)
        ['P', rootAuthorPubkey],
      ];

      // Add parent tags if this is a reply to a comment
      if (parentEventId && parentAuthorPubkey) {
        tags.push(
          ['e', parentEventId, '', parentAuthorPubkey],
          ['k', '1111'], // Parent kind is comment
          ['p', parentAuthorPubkey]
        );
      } else {
        // Top-level comment - parent is the same as root
        tags.push(
          ['e', rootEventId, '', rootAuthorPubkey],
          ['k', '20'], // Parent kind is image post
          ['p', rootAuthorPubkey]
        );
      }

      const event = await user.signer.signEvent({
        kind: 1111,
        content,
        tags,
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event);
      return event;
    },
    onSuccess: (_, variables) => {
      // Invalidate comments query to refetch
      queryClient.invalidateQueries({ queryKey: ['comments', variables.rootEventId] });
      if (variables.parentEventId) {
        queryClient.invalidateQueries({ queryKey: ['comment-replies', variables.parentEventId] });
      }
    },
  });
}