import { useNostr } from "@nostrify/react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";
import { useRefreshNotifications } from "./useRefreshNotifications";

import type { NostrEvent } from "@nostrify/nostrify";

export function useNostrPublish(): UseMutationResult<NostrEvent> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { refreshNotifications } = useRefreshNotifications();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (t: Omit<NostrEvent, "id" | "pubkey" | "sig">) => {
      if (user) {
        const tags = t.tags ?? [];

        // Add the client tag if it doesn't exist
        if (
          location.protocol === "https:" &&
          !tags.some(([name]) => name === "client")
        ) {
          tags.push(["client", location.hostname]);
        }

        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        // The NostrProvider with outbox model will automatically route this event
        // to the user's write relays and any mentioned users' read relays
        await nostr.event(event, { signal: AbortSignal.timeout(15000) });

        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: () => {
      // Error handled by mutation
    },
    onSuccess: (data) => {
      // Add a small delay to allow the event to propagate to relays
      // This ensures the new post will be included when queries are refetched
      setTimeout(() => {
        // Invalidate relevant queries when publishing content
        if ([20, 22, 34236].includes(data.kind) && user) {
        // Invalidate video posts queries for kinds 22 and 34236 (short vertical videos)
        if ([22, 34236].includes(data.kind)) {
          // User's own video posts
          queryClient.invalidateQueries({
            queryKey: ['user-video-posts', user.pubkey]
          });

          // Global video feeds (all variations)
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'all-video-posts'
          });
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'video-posts'
          });
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'optimized-all-video-posts'
          });

          // Following video feeds
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'following-all-video-posts'
          });
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'following-video-posts'
          });
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'optimized-following-all-video-posts'
          });

          // Hashtag video feeds
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'hashtag-all-video-posts'
          });
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'hashtag-video-posts'
          });
        }

        // Invalidate image posts queries for kind 20
        if (data.kind === 20) {
          // User's own image posts
          queryClient.invalidateQueries({
            queryKey: ['user-image-posts', user.pubkey]
          });

          // Global image feeds (all variations)
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'image-posts'
          });
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'optimized-image-posts'
          });

          // Following image feeds
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'following-image-posts'
          });
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'optimized-following-image-posts'
          });

          // Hashtag image feeds
          queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'hashtag-image-posts'
          });
        }

        // Wait a moment for the event to propagate, then refresh notifications
        setTimeout(() => {
          refreshNotifications();
        }, 2000);
      }
      }, 500); // 500ms delay for query invalidation
    },
  });
}
