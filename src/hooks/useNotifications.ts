import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import type { NostrEvent } from "@nostrify/nostrify";
import { useCurrentUser } from "./useCurrentUser";
import { useEffect } from "react";

export interface NotificationEvent {
  id: string;
  type: 'reaction' | 'comment' | 'zap';
  event: NostrEvent;
  targetEvent?: NostrEvent;
  read: boolean;
  created_at: number;
}

// Validator function for image/video events (kind 20, 22, 34236)
function isImageOrVideoEvent(event: NostrEvent): boolean {
  return [20, 22, 34236].includes(event.kind);
}

export function useNotifications() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  const query = useQuery({
    queryKey: ['notifications', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) {
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      
      try {
        
        // Strategy 1: Get user's image and video posts first
        const userPosts = await nostr.query([
          {
            kinds: [20, 22, 34236], // Image and video posts
            authors: [user.pubkey],
            limit: 100, // Get recent posts to check for notifications
          }
        ], { signal });

        // Strategy 2: Also try to find notifications by looking for events that mention the user
        // This can catch notifications even if we don't have all the user's posts indexed
        const mentionNotifications = await Promise.all([
          // Look for reactions mentioning the user
          nostr.query([
            {
              kinds: [7],
              '#p': [user.pubkey],
              limit: 25,
            }
          ], { signal }),
          // Look for comments (kind 1111) mentioning the user  
          nostr.query([
            {
              kinds: [1111],
              '#p': [user.pubkey],
              limit: 25,
            }
          ], { signal }),
          // Look for zaps mentioning the user
          nostr.query([
            {
              kinds: [9735],
              '#p': [user.pubkey],
              limit: 25,
            }
          ], { signal }),
        ]);

        const [mentionReactions, mentionComments, mentionZaps] = mentionNotifications;

        if (userPosts.length === 0 && mentionReactions.length === 0 && mentionComments.length === 0 && mentionZaps.length === 0) {
          return [];
        }

        // Combine both strategies: post-based and mention-based notifications
        let reactions: NostrEvent[] = [];
        let comments: NostrEvent[] = [];
        let zaps: NostrEvent[] = [];

        // Strategy 1: Post-based notifications (if we have posts)
        if (userPosts.length > 0) {
          const userPostIds = userPosts.map(post => post.id);

          const postBasedNotifications = await Promise.all([
            nostr.query([{ kinds: [7], '#e': userPostIds, limit: 50 }], { signal }),
            nostr.query([{ kinds: [1111], '#e': userPostIds, limit: 50 }], { signal }),
            nostr.query([{ kinds: [9735], '#e': userPostIds, limit: 50 }], { signal }),
          ]);

          reactions = postBasedNotifications[0];
          comments = postBasedNotifications[1];
          zaps = postBasedNotifications[2];
        }

        // Strategy 2: Merge with mention-based notifications
        // Combine and deduplicate
        const allReactions = [...reactions, ...mentionReactions].filter((event, index, self) => 
          index === self.findIndex(e => e.id === event.id)
        );
        const allComments = [...comments, ...mentionComments].filter((event, index, self) => 
          index === self.findIndex(e => e.id === event.id)
        );
        const allZaps = [...zaps, ...mentionZaps].filter((event, index, self) => 
          index === self.findIndex(e => e.id === event.id)
        );

        // Filter out user's own interactions
        const filteredReactions = allReactions.filter(event => event.pubkey !== user.pubkey);
        const filteredComments = allComments.filter(event => event.pubkey !== user.pubkey);
        const filteredZaps = allZaps.filter(event => event.pubkey !== user.pubkey);

        // Create notification objects
        const notifications: NotificationEvent[] = [];

        // Helper function to check if a notification event references a valid target
        const isValidNotification = async (event: NostrEvent, _eventType: 'reaction' | 'comment' | 'zap') => {
          // First, try to find the target post in our known user posts
          const targetPost = userPosts.find(post => 
            event.tags.some(tag => tag[0] === 'e' && tag[1] === post.id)
          );
          
          if (targetPost && isImageOrVideoEvent(targetPost)) {
            return { valid: true, targetPost };
          }
          
          // If we don't have the target post locally, check if the event references
          // an image/video post by querying for the referenced event
          const referencedEventIds = event.tags
            .filter(tag => tag[0] === 'e')
            .map(tag => tag[1]);
            
          if (referencedEventIds.length > 0) {
            try {
              const referencedEvents = await nostr.query([
                {
                  ids: referencedEventIds,
                  kinds: [20, 22, 34236], // Only look for our supported kinds
                  authors: [user.pubkey], // Only the user's own posts
                  limit: 10,
                }
              ], { signal });
              
              // Find the first valid referenced event
              const validTarget = referencedEvents.find(isImageOrVideoEvent);
              if (validTarget) {
                return { valid: true, targetPost: validTarget };
              }
            } catch (error) {
              // If query fails, skip this notification
              console.warn('Failed to verify notification target:', error);
            }
          }
          
          return { valid: false, targetPost: undefined };
        };

        // Process reactions
        for (const reaction of filteredReactions) {
          const { valid, targetPost } = await isValidNotification(reaction, 'reaction');
          if (valid) {
            notifications.push({
              id: reaction.id,
              type: 'reaction',
              event: reaction,
              targetEvent: targetPost,
              read: false,
              created_at: reaction.created_at,
            });
          }
        }

        // Process comments
        for (const comment of filteredComments) {
          const { valid, targetPost } = await isValidNotification(comment, 'comment');
          if (valid) {
            notifications.push({
              id: comment.id,
              type: 'comment',
              event: comment,
              targetEvent: targetPost,
              read: false,
              created_at: comment.created_at,
            });
          }
        }

        // Process zaps
        for (const zap of filteredZaps) {
          const { valid, targetPost } = await isValidNotification(zap, 'zap');
          if (valid) {
            notifications.push({
              id: zap.id,
              type: 'zap',
              event: zap,
              targetEvent: targetPost,
              read: false,
              created_at: zap.created_at,
            });
          }
        }

        // Sort by created_at (newest first) and deduplicate
        const sortedNotifications = notifications
          .sort((a, b) => b.created_at - a.created_at)
          .filter((notification, index, self) => 
            index === self.findIndex(n => n.id === notification.id)
          );

        return sortedNotifications;
      } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
    },
    enabled: !!user?.pubkey,
    staleTime: 30000, // 30 seconds - longer stale time to reduce conflicts with read state
    refetchInterval: 60000, // 60 seconds - less aggressive auto-refresh
    refetchIntervalInBackground: false, // Don't refresh when tab is not active
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    refetchOnMount: true, // Fetch when component mounts if no data exists
    refetchOnReconnect: true, // Refresh when network reconnects
    retry: 3,
    retryDelay: 1000,
  });

  // Force immediate fetch when user becomes available
  useEffect(() => {
    if (user?.pubkey && !query.isFetching && !query.data?.length) {
      query.refetch();
    }
  }, [user?.pubkey, query]);

  return query;
}

