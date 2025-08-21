import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { useCurrentUser } from "./useCurrentUser";
import { useNostrPublish } from "./useNostrPublish";
import { useMemo } from "react";
import type { NostrEvent } from "@nostrify/nostrify";

// Using NIP-51 bookmark sets (kind 30003) with d tag "nip-68-posts"
export function useBookmarks() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["bookmarks", user?.pubkey],
    queryFn: async (c) => {


      if (!user?.pubkey) {
        console.log("useBookmarks - No user pubkey");
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Get user's bookmark set (kind 30003 - NIP-51 bookmark sets with d tag "nip-68-posts")
      const bookmarkSetEvents = await nostr.query([
        {
          kinds: [30003],
          authors: [user.pubkey],
          "#d": ["nip-68-posts"],
          limit: 1,
        }
      ]);

      const bookmarkEvents = await nostr.query(
        [
          {
            kinds: [30003],
            authors: [user.pubkey],
            "#d": ["nip-68-posts"],
            limit: 1,
          },
        ],
        { signal }
      );



      // Debug: Try to query for any events by this user to see if the issue is with the query itself
      try {
        const allUserEvents = await nostr.query(
          [
            {
              authors: [user.pubkey],
              limit: 5,
            },
          ],
          { signal }
        );
        console.log(
          "useBookmarks - Debug: All user events found:",
          allUserEvents.length,
          allUserEvents
        );
      } catch (error) {
        console.log(
          "useBookmarks - Debug: Error querying all user events:",
          error
        );
      }

      console.log(
        "useBookmarks - Found bookmark events:",
        bookmarkEvents.length,
        bookmarkEvents
      );

      if (bookmarkEvents.length === 0) {
        console.log("useBookmarks - No bookmark set found");
        return [];
      }

      const bookmarkSet = bookmarkEvents[0];
      console.log("useBookmarks - Bookmark set tags:", bookmarkSet.tags);

      // Extract event IDs from 'e' tags
      const eventIds = bookmarkSet.tags
        .filter(([name]) => name === "e")
        .map(([, eventId]) => eventId)
        .filter(Boolean);

      console.log("useBookmarks - Extracted event IDs:", eventIds);

      if (eventIds.length === 0) {
        console.log("useBookmarks - No event IDs in bookmark set");
        return [];
      }

      // Fetch the bookmarked events - try multiple strategies
      console.log("useBookmarks - Fetching events by IDs");
      console.log("useBookmarks - Target event IDs:", eventIds);

      // Strategy 1: Try to fetch all events at once
      let allEvents = await nostr.query(
        [
          {
            ids: eventIds,
            limit: 100,
          },
        ],
        { signal }
      );

      console.log(
        "useBookmarks - Strategy 1 - Fetched events:",
        allEvents.length,
        allEvents
      );

      // Strategy 2: If we didn't get all events, try without limit
      if (allEvents.length < eventIds.length) {
        console.log("useBookmarks - Strategy 2 - Trying query without limit");
        try {
          const unlimitedEvents = await nostr.query(
            [
              {
                ids: eventIds,
              },
            ],
            { signal: AbortSignal.timeout(4000) }
          );

          console.log(
            "useBookmarks - Strategy 2 - Unlimited query result:",
            unlimitedEvents.length,
            unlimitedEvents
          );

          // Merge results, avoiding duplicates
          const existingIds = new Set(allEvents.map((e) => e.id));
          const newEvents = unlimitedEvents.filter(
            (e) => !existingIds.has(e.id)
          );
          allEvents = [...allEvents, ...newEvents];

          console.log(
            "useBookmarks - After strategy 2:",
            allEvents.length,
            "total events"
          );
        } catch (error) {
          console.log("useBookmarks - Strategy 2 failed:", error);
        }
      }

      // Strategy 3: If we still don't have all events, try fetching them individually
      // This might help with relay-specific availability
      if (allEvents.length < eventIds.length) {
        console.log(
          "useBookmarks - Strategy 3 - Trying individual queries for missing events"
        );
        const foundIds = new Set(allEvents.map((e) => e.id));
        const missingIds = eventIds.filter((id) => !foundIds.has(id));

        console.log("useBookmarks - Missing event IDs:", missingIds);

        for (const eventId of missingIds) {
          try {
            const individualEvents = await nostr.query(
              [
                {
                  ids: [eventId],
                  limit: 1,
                },
              ],
              { signal: AbortSignal.timeout(3000) }
            );

            console.log(
              `useBookmarks - Individual query for ${eventId}:`,
              individualEvents.length,
              individualEvents
            );
            allEvents = [...allEvents, ...individualEvents];
          } catch (error) {
            console.log(
              `useBookmarks - Failed to fetch individual event ${eventId}:`,
              error
            );
          }
        }
      }

      console.log(
        "useBookmarks - Final fetched events after all strategies:",
        allEvents.length,
        allEvents
      );

      // For debugging: verify what we have
      console.log("useBookmarks - Final analysis:", {
        requestedEventIds: eventIds,
        foundEventIds: allEvents.map((e) => e.id),
        missingEventIds: eventIds.filter(
          (id) => !allEvents.some((e) => e.id === id)
        ),
        eventsByKind: allEvents.reduce((acc, event) => {
          acc[event.kind] = (acc[event.kind] || 0) + 1;
          return acc;
        }, {} as Record<number, number>),
      });

      // Display all bookmarked events regardless of kind for now
      const validEvents = allEvents
        .filter((event) => {
          // Basic validation - just ensure it's a valid event
          const isValid =
            event &&
            event.id &&
            event.pubkey &&
            typeof event.created_at === "number";
          console.log("useBookmarks - Event validation:", event.id, {
            kind: event.kind,
            hasContent: !!event.content,
            tagCount: event.tags?.length || 0,
            isValid,
            created: new Date(event.created_at * 1000).toISOString(),
          });

          return isValid;
        })
        .sort((a, b) => b.created_at - a.created_at);

      console.log(
        "useBookmarks - Final valid events:",
        validEvents.length,
        "out of",
        eventIds.length,
        "requested"
      );

      // If we have missing events, add placeholder objects for debugging
      const missingEventIds = eventIds.filter(
        (id) => !validEvents.some((e) => e.id === id)
      );
      if (missingEventIds.length > 0) {
        console.log(
          "useBookmarks - Events not found on any relay:",
          missingEventIds
        );
        // Optionally, you could add placeholder events to show in the UI that some bookmarks are missing
      }

      return validEvents;
    },
    enabled: !!user?.pubkey,
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get bookmark set data for efficient status checking
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

        // Get bookmark set (kind 30003 with d tag "nip-68-posts")
        const bookmarkEvents = await nostr.query(
          [
            {
              kinds: [30003],
              authors: [user.pubkey],
              "#d": ["nip-68-posts"],
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

// Efficient bookmark status check using cached bookmark set
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
  }, [
    bookmarkList.data,
    bookmarkList.isLoading,
    bookmarkList.error,
    eventId,
    user?.pubkey,
  ]);
}

// Hook to create an initial empty bookmark set if none exists
export function useCreateInitialBookmarkList() {
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.signer || !user?.pubkey) {
        throw new Error("User not logged in");
      }

      const eventTemplate = {
        kind: 30003,
        content: "",
        tags: [
          ["d", "nip-68-posts"],
          ["title", "NIP-68 Bookmarked Images"],
          ["description", "Images bookmarked from Zappix"],
        ], // Empty bookmark set with required d tag
      };

      console.log(
        "useCreateInitialBookmarkList - Creating initial bookmark set:",
        eventTemplate
      );
      const event = await publishEvent(eventTemplate);
      console.log("useCreateInitialBookmarkList - Created event:", event);
      return event;
    },
    onSuccess: () => {
      // Invalidate bookmark queries to refetch
      queryClient.invalidateQueries({ queryKey: ["bookmark-list"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}

export function useToggleBookmark() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const bookmarkList = useBookmarkList();
  const { mutateAsync: createInitialBookmarkList } =
    useCreateInitialBookmarkList();

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

      // Use cached bookmark set data instead of querying again
      const currentBookmarkSet = bookmarkList.data;
      let currentTags: string[][] = [];

      if (currentBookmarkSet) {
        currentTags = currentBookmarkSet.tags;
      } else {
        // If no bookmark set exists, create one first
        console.log(
          "useToggleBookmark - No bookmark set exists, creating initial set"
        );
        await createInitialBookmarkList();
        // The bookmark set should now exist, but we'll proceed with base tags for this operation
        currentTags = [
          ["d", "nip-68-posts"],
          ["title", "NIP-68 Bookmarked Images"],
          ["description", "Images bookmarked from Zappix"],
        ];
      }

      let newTags: string[][];

      if (isBookmarked) {
        // Remove bookmark
        newTags = currentTags.filter(
          ([name, id]) => !(name === "e" && id === eventId)
        );
      } else {
        // Add bookmark - ensure we have the required tags
        const baseTags = currentTags.filter(([name]) =>
          ["d", "title", "description"].includes(name)
        );
        const eventTags = currentTags.filter(([name]) => name === "e");
        newTags = [...baseTags, ...eventTags, ["e", eventId]];
      }

      // Ensure we always have the required d tag
      if (!newTags.some(([name]) => name === "d")) {
        newTags.unshift(["d", "nip-68-posts"]);
      }

      const eventTemplate = {
        kind: 30003,
        content: "",
        tags: newTags,
      };

      console.log("useToggleBookmark - Publishing event:", eventTemplate);
      console.log("useToggleBookmark - Event tags breakdown:", {
        dTag: newTags.find(([name]) => name === "d"),
        titleTag: newTags.find(([name]) => name === "title"),
        descriptionTag: newTags.find(([name]) => name === "description"),
        eTags: newTags.filter(([name]) => name === "e"),
        allTags: newTags,
      });
      const event = await publishEvent(eventTemplate);
      console.log("useToggleBookmark - Published event:", event);
      return event;
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["bookmark-list"] });

      // Snapshot the previous bookmark list
      const previousBookmarkList = queryClient.getQueryData([
        "bookmark-list",
        user?.pubkey,
      ]);

      // Optimistically update the bookmark list
      if (previousBookmarkList) {
        const currentTags = (previousBookmarkList as NostrEvent).tags || [];
        let newTags: string[][];

        if (variables.isBookmarked) {
          // Remove bookmark
          newTags = currentTags.filter(
            ([name, id]: string[]) =>
              !(name === "e" && id === variables.eventId)
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
        queryClient.setQueryData(
          ["bookmark-list", user?.pubkey],
          context.previousBookmarkList
        );
      }
    },
    onSuccess: () => {
      // Invalidate to get fresh data from the network
      queryClient.invalidateQueries({ queryKey: ["bookmark-list"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}
