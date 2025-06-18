import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { useCurrentUser } from "./useCurrentUser";
import { useNostrPublish } from "./useNostrPublish";
import { useMemo } from "react";
import type { NostrEvent } from "@nostrify/nostrify";

// Using NIP-51 standard bookmarks (kind 10003)
export function useBookmarks() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["bookmarks", user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) {
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);

      // Get user's bookmark list (kind 10003 - standard NIP-51 bookmarks)
      const bookmarkEvents = await nostr.query(
        [
          {
            kinds: [10003],
            authors: [user.pubkey],
            limit: 1,
          },
        ],
        { signal }
      );

      if (bookmarkEvents.length === 0) {
        return [];
      }

      const bookmarkList = bookmarkEvents[0];

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

// Get bookmark list data for efficient status checking
export function useBookmarkList() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<NostrEvent | null>({
    queryKey: ["bookmark-list", user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) {
        return null;
      }

      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(1500)]);

        // Get bookmark list (kind 10003)
        const bookmarkEvents = await nostr.query(
          [
            {
              kinds: [10003],
              authors: [user.pubkey],
              limit: 1,
            },
          ],
          { signal }
        );

        return bookmarkEvents[0] || null;
      } catch {
        return null;
      }
    },
    enabled: !!user?.pubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// Efficient bookmark status check using cached bookmark list
export function useIsBookmarked(eventId: string) {
  const bookmarkList = useBookmarkList();
  const { user } = useCurrentUser();

  return useMemo(() => {
    if (!user?.pubkey || !eventId || !bookmarkList.data) {
      return {
        data: false,
        isLoading: bookmarkList.isLoading,
        error: bookmarkList.error,
      };
    }

    const isBookmarked = bookmarkList.data.tags.some(
      ([name, id]) => name === "e" && id === eventId
    );

    return {
      data: isBookmarked,
      isLoading: false,
      error: null,
    };
  }, [bookmarkList.data, bookmarkList.isLoading, bookmarkList.error, eventId, user?.pubkey]);
}

export function useToggleBookmark() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const bookmarkList = useBookmarkList();

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

      // Use cached bookmark list data instead of querying again
      const currentBookmarkList = bookmarkList.data;
      let currentTags: string[][] = [];

      if (currentBookmarkList) {
        currentTags = currentBookmarkList.tags;
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
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["bookmark-list"] });

      // Snapshot the previous bookmark list
      const previousBookmarkList = queryClient.getQueryData(["bookmark-list", user?.pubkey]);

      // Optimistically update the bookmark list
      if (previousBookmarkList) {
        const currentTags = (previousBookmarkList as NostrEvent).tags || [];
        let newTags: string[][];

        if (variables.isBookmarked) {
          // Remove bookmark
          newTags = currentTags.filter(
            ([name, id]: string[]) => !(name === "e" && id === variables.eventId)
          );
        } else {
          // Add bookmark
          newTags = [...currentTags, ["e", variables.eventId]];
        }

        queryClient.setQueryData(["bookmark-list", user?.pubkey], {
          ...(previousBookmarkList as NostrEvent),
          tags: newTags,
        });
      }

      return { previousBookmarkList };
    },
    onError: (_, __, context) => {
      // Roll back on error
      if (context?.previousBookmarkList) {
        queryClient.setQueryData(["bookmark-list", user?.pubkey], context.previousBookmarkList);
      }
    },
    onSuccess: () => {
      // Invalidate to get fresh data from the network
      queryClient.invalidateQueries({ queryKey: ["bookmark-list"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}
