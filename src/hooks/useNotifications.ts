import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import type { NostrEvent } from "@nostrify/nostrify";
import { useCurrentUser } from "./useCurrentUser";

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

      // Use a shorter timeout to prevent hanging
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
      
      try {
        if (import.meta.env.DEV) {
          console.log('Fetching notifications for user:', user.pubkey);
        }
        
        // Simplified approach: Get user's posts and notifications in parallel
        const [userPosts, reactions, comments, zaps] = await Promise.all([
          // Get user's image and video posts
          nostr.query([{
            kinds: [20, 22, 34236],
            authors: [user.pubkey],
            limit: 50, // Reduced limit for better performance
          }], { signal }),
          
          // Get reactions mentioning the user
          nostr.query([{
            kinds: [7],
            '#p': [user.pubkey],
            limit: 30,
          }], { signal }),
          
          // Get comments mentioning the user
          nostr.query([{
            kinds: [1111],
            '#p': [user.pubkey],
            limit: 30,
          }], { signal }),
          
          // Get zaps mentioning the user
          nostr.query([{
            kinds: [9735],
            '#p': [user.pubkey],
            limit: 30,
          }], { signal }),
        ]);

        if (import.meta.env.DEV) {
          console.log('Notification query results:', {
            userPosts: userPosts.length,
            reactions: reactions.length,
            comments: comments.length,
            zaps: zaps.length
          });
        }

        // If we have user posts, also get notifications for those posts
        let postReactions: NostrEvent[] = [];
        let postComments: NostrEvent[] = [];
        let postZaps: NostrEvent[] = [];

        if (userPosts.length > 0) {
          const userPostIds = userPosts.map(post => post.id);
          
          try {
            [postReactions, postComments, postZaps] = await Promise.all([
              nostr.query([{ kinds: [7], '#e': userPostIds, limit: 30 }], { signal }),
              nostr.query([{ kinds: [1111], '#e': userPostIds, limit: 30 }], { signal }),
              nostr.query([{ kinds: [9735], '#e': userPostIds, limit: 30 }], { signal }),
            ]);
          } catch (error) {
            console.warn('Failed to fetch post-based notifications:', error);
            // Continue with mention-based notifications only
          }
        }

        // Combine and deduplicate all notifications
        const allReactions = [...reactions, ...postReactions]
          .filter((event, index, self) => index === self.findIndex(e => e.id === event.id))
          .filter(event => event.pubkey !== user.pubkey); // Filter out user's own reactions

        const allComments = [...comments, ...postComments]
          .filter((event, index, self) => index === self.findIndex(e => e.id === event.id))
          .filter(event => event.pubkey !== user.pubkey); // Filter out user's own comments

        const allZaps = [...zaps, ...postZaps]
          .filter((event, index, self) => index === self.findIndex(e => e.id === event.id))
          .filter(event => event.pubkey !== user.pubkey); // Filter out user's own zaps

        // Create notification objects
        const notifications: NotificationEvent[] = [];

        // Helper function to find target post for a notification
        const findTargetPost = (event: NostrEvent): NostrEvent | undefined => {
          // Look for referenced event IDs in tags
          const referencedEventIds = event.tags
            .filter(tag => tag[0] === 'e')
            .map(tag => tag[1]);
            
          // Find the target post in our user posts
          for (const eventId of referencedEventIds) {
            const targetPost = userPosts.find(post => post.id === eventId);
            if (targetPost && isImageOrVideoEvent(targetPost)) {
              return targetPost;
            }
          }
          
          return undefined;
        };

        // Process reactions
        for (const reaction of allReactions) {
          const targetPost = findTargetPost(reaction);
          if (targetPost) {
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
        for (const comment of allComments) {
          const targetPost = findTargetPost(comment);
          if (targetPost) {
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
        for (const zap of allZaps) {
          const targetPost = findTargetPost(zap);
          if (targetPost) {
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

        if (import.meta.env.DEV) {
          console.log('Final notifications:', sortedNotifications.length);
        }
        return sortedNotifications;
      } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
    },
    enabled: !!user?.pubkey,
    staleTime: 60000, // 1 minute - longer stale time for better consistency
    refetchInterval: 120000, // 2 minutes - less aggressive auto-refresh
    refetchIntervalInBackground: false, // Don't refresh when tab is not active
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    refetchOnMount: 'always', // Always fetch when component mounts
    refetchOnReconnect: true, // Refresh when network reconnects
    retry: 1, // Reduce retries to prevent blocking
    retryDelay: 2000, // Fixed 2 second delay
    // Don't block other queries if this one fails
    throwOnError: false,
  });

  return query;
}

