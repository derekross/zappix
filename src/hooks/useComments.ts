import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

function validateCommentEvent(event: NostrEvent): boolean {
  if (event.kind !== 1111) return false;

  const hasRootScope = event.tags.some(([name]) => ['E', 'A', 'I'].includes(name));
  if (!hasRootScope) return false;

  const kTag = event.tags.find(([name]) => name === 'K');
  if (!kTag || !kTag[1]) return false;

  return true;
}

export function useComments(eventId: string, _authorPubkey: string) {
  const { nostr } = useNostr();

  const result = useInfiniteQuery({
    queryKey: ['comments', eventId],
    queryFn: async ({ pageParam, signal }) => {
      const querySignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);

      const filter: { kinds: number[]; '#E': string[]; limit: number; until?: number } = {
        kinds: [1111],
        '#E': [eventId],
        limit: 20,
      };

      if (pageParam) {
        filter.until = pageParam - 1;
      }

      const events = await nostr.query([filter], { signal: querySignal });
      const validComments = events.filter(validateCommentEvent);
      const sortedComments = validComments.sort((a, b) => b.created_at - a.created_at);

      return {
        comments: sortedComments,
        nextCursor: sortedComments.length > 0 ? sortedComments[sortedComments.length - 1].created_at : undefined,
        hasMore: sortedComments.length === filter.limit,
      };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 30000,
  });

  return {
    ...result,
    refetch: async () => {
      // Reset the infinite query and refetch first page
      await result.refetch();
    },
  };
}

export function useCommentReplies(commentId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['comment-replies', commentId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      const events = await nostr.query([
        {
          kinds: [1111],
          '#e': [commentId],
          limit: 50,
        },
      ], { signal });

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
      parentAuthorPubkey,
    }: {
      content: string;
      rootEventId: string;
      rootAuthorPubkey: string;
      parentEventId?: string;
      parentAuthorPubkey?: string;
    }) => {
      if (!user?.signer) throw new Error('User not logged in');

      const tags = [
        ['E', rootEventId, '', rootAuthorPubkey],
        ['K', '20'],
        ['P', rootAuthorPubkey],
      ];

      if (parentEventId && parentAuthorPubkey) {
        tags.push(
          ['e', parentEventId, '', parentAuthorPubkey],
          ['k', '1111'],
          ['p', parentAuthorPubkey]
        );
      } else {
        tags.push(
          ['e', rootEventId, '', rootAuthorPubkey],
          ['k', '20'],
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
      queryClient.invalidateQueries({ queryKey: ['comments', variables.rootEventId] });
      if (variables.parentEventId) {
        queryClient.invalidateQueries({ queryKey: ['comment-replies', variables.parentEventId] });
      }
    },
  });
}
