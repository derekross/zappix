import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { useCurrentUser } from "./useCurrentUser";
import { useNostrPublish } from "./useNostrPublish";

// Using NIP-51 standard bookmarks (kind 10003) instead of bookmark sets (kind 30003)

export function useBookmarks() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["bookmarks", user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) {
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);

      // Get user's bookmark list - try both new format (kind 10003) and old format (kind 30003)
      const [newBookmarkEvents, oldBookmarkEvents] = await Promise.all([
        // New format: kind 10003 (standard NIP-51 bookmarks)
        nostr.query(
          [
            {
              kinds: [10003],
              authors: [user.pubkey],
              limit: 1,
            },
          ],
          { signal }
        ),
        // Old format: kind 30003 with d tag (for migration)
        nostr.query(
          [
            {
              kinds: [30003],
              authors: [user.pubkey],
              "#d": ["nip-68-posts"],
              limit: 1,
            },
          ],
          { signal }
        )
      ]);

      let bookmarkList;
      if (newBookmarkEvents.length > 0) {
        bookmarkList = newBookmarkEvents[0];
      } else if (oldBookmarkEvents.length > 0) {
        bookmarkList = oldBookmarkEvents[0];
      } else {
        return [];
      }

      // Extract event IDs from 'e' tags
      const eventIds = bookmarkList.tags
        .filter(([name]) => name === "e")
        .map(([, eventId]) => eventId)
        .filter(Boolean);

      if (eventIds.length === 0) {
        return [];
      }

      // Fetch the bookmarked events
      const allEvents = await nostr.query(
        [
          {
            ids: eventIds,
            limit: 100,
          },
        ],
        { signal }
      );

      // Filter for kind 20 (image posts)
      const events = allEvents.filter(event => event.kind === 20);

      // Filter to only valid image events
      const validEvents = events
        .filter((event) => {
          const title = event.tags.find(([name]) => name === "title")?.[1];
          const imeta = event.tags.find(([name]) => name === "imeta");
          
          // Require either title OR imeta
          return title || imeta;
        })
        .sort((a, b) => b.created_at - a.created_at);

      return validEvents;
    },
    enabled: !!user?.pubkey,
    staleTime: 60000,
  });
}

export function useIsBookmarked(eventId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["is-bookmarked", eventId, user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) {
        return false;
      }

      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

        // Check both new format (kind 10003) and old format (kind 30003)
        const [newBookmarkEvents, oldBookmarkEvents] = await Promise.all([
          nostr.query(
            [
              {
                kinds: [10003],
                authors: [user.pubkey],
                limit: 1,
              },
            ],
            { signal }
          ),
          nostr.query(
            [
              {
                kinds: [30003],
                authors: [user.pubkey],
                "#d": ["nip-68-posts"],
                limit: 1,
              },
            ],
            { signal }
          )
        ]);

        let bookmarkList;
        if (newBookmarkEvents.length > 0) {
          bookmarkList = newBookmarkEvents[0];
        } else if (oldBookmarkEvents.length > 0) {
          bookmarkList = oldBookmarkEvents[0];
        } else {
          return false;
        }

        const isBookmarked = bookmarkList.tags.some(
          ([name, id]) => name === "e" && id === eventId
        );
        
        return isBookmarked;
      } catch {
        return false;
      }
    },
    enabled: !!user?.pubkey && !!eventId,
    staleTime: 30000,
    retry: 1, // Only retry once
    retryDelay: 1000, // Wait 1 second before retry
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
  });
}

export function useToggleBookmark() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();

  return useMutation({
    mutationFn: async ({
      eventId,
      isBookmarked,
    }: {
      eventId: string;
      isBookmarked: boolean;
    }) => {
      if (!user?.signer || !user?.pubkey) {
        throw new Error("User not logged in");
      }

      // Get current bookmark set with timeout
      const signal = AbortSignal.timeout(10000);
      const bookmarkEvents = await nostr.query([
        {
          kinds: [10003],
          authors: [user.pubkey],
          limit: 1,
        },
      ], { signal });

      let currentTags: string[][] = [];

      if (bookmarkEvents.length > 0) {
        currentTags = bookmarkEvents[0].tags;
      } else {
        // If no bookmark list exists, create an empty one (kind 10003 doesn't need a 'd' tag)
        currentTags = [];
      }

      let newTags: string[][];

      if (isBookmarked) {
        // Remove bookmark
        newTags = currentTags.filter(
          ([name, id]) => !(name === "e" && id === eventId)
        );
      } else {
        // Add bookmark
        newTags = [...currentTags, ["e", eventId]];
      }

      const eventTemplate = {
        kind: 10003,
        content: "",
        tags: newTags,
      };

      const event = await publishEvent(eventTemplate);
      return event;
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["is-bookmarked", variables.eventId] });

      // Snapshot the previous value
      const previousBookmarkStatus = queryClient.getQueryData(["is-bookmarked", variables.eventId, user?.pubkey]);

      // Optimistically update to the new value
      queryClient.setQueryData(["is-bookmarked", variables.eventId, user?.pubkey], !variables.isBookmarked);

      // Return a context object with the snapshotted value
      return { previousBookmarkStatus };
    },
    onError: (_, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousBookmarkStatus !== undefined) {
        queryClient.setQueryData(["is-bookmarked", variables.eventId, user?.pubkey], context.previousBookmarkStatus);
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate bookmark queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({
        queryKey: ["is-bookmarked", variables.eventId],
      });
    },
  });
}
