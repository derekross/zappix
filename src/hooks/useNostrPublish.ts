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

        // DEBUG: Log the event being published
        console.log('PUBLISH DEBUG: Publishing event:', {
          id: event.id,
          kind: event.kind,
          pubkey: event.pubkey.slice(0, 8),
          created_at: event.created_at,
          timestamp: new Date(event.created_at * 1000).toISOString(),
          content: event.content.slice(0, 50) + '...',
          tags: event.tags.map(tag => `${tag[0]}:${tag[1]?.slice(0, 30) || ''}...`)
        });

        // The NostrProvider with outbox model will automatically route this event
        // to the user's write relays and any mentioned users' read relays
        await nostr.event(event, { signal: AbortSignal.timeout(15000) });
        
        console.log('PUBLISH DEBUG: Event published successfully to relays');
        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: (error) => {
      // Error handled by mutation
    },
    onSuccess: (data) => {
      
      // Invalidate relevant queries when publishing content
      if ([20, 22, 34236].includes(data.kind) && user) {
        // Invalidate user video posts query
        if ([22, 34236].includes(data.kind)) {
          console.log('PUBLISH DEBUG: Invalidating video queries after publishing kind', data.kind);
          
          queryClient.invalidateQueries({ 
            queryKey: ['user-video-posts', user.pubkey] 
          });
          
          // Also invalidate global and following video feeds
          queryClient.invalidateQueries({ 
            predicate: (query) => query.queryKey[0] === 'all-video-posts'
          });
          queryClient.invalidateQueries({ 
            predicate: (query) => query.queryKey[0] === 'following-all-video-posts'
          });
          queryClient.invalidateQueries({ 
            predicate: (query) => query.queryKey[0] === 'hashtag-all-video-posts'
          });
          
          console.log('PUBLISH DEBUG: Queries invalidated, waiting for refetch...');
        }
        
        // Invalidate user image posts query
        if (data.kind === 20) {
          queryClient.invalidateQueries({ 
            queryKey: ['user-image-posts', user.pubkey] 
          });
          
          // Also invalidate global and following image feeds if they exist
          queryClient.invalidateQueries({ 
            queryKey: ['all-image-posts'] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ['following-all-image-posts'] 
          });
        }
        
        // Wait a moment for the event to propagate, then refresh notifications
        setTimeout(() => {
          refreshNotifications();
        }, 2000);
      }
    },
  });
}
