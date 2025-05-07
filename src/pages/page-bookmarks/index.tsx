import { NDKEvent, NDKFilter, NDKKind, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk";
import React, { useEffect, useState } from "react";
import { useNdk } from "../../contexts/NdkContext";
import { ImagePost } from "../../components/image-post";
import { Loader } from "../../components/ui/icons";

export const BookmarksPage: React.FC = () => {
  const { ndk, user: loggedInUser } = useNdk();
  const [bookmarkedEvents, setBookmarkedEvents] = useState<NDKEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!ndk || !loggedInUser) return;

    const fetchBookmarks = async () => {
      try {
        // First, get the bookmark list
        const bookmarkFilter: NDKFilter = {
          authors: [loggedInUser.pubkey],
          kinds: [10003],
          "#t": ["bookmark"],
          "#k": ["20"],
        };

        const bookmarkList = await ndk.fetchEvent(bookmarkFilter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });

        if (!bookmarkList) {
          setBookmarkedEvents([]);
          setIsLoading(false);
          return;
        }

        // Extract event IDs from the bookmark list
        const eventIds = bookmarkList.tags.filter((tag) => tag[0] === "e").map((tag) => tag[1]);

        if (eventIds.length === 0) {
          setBookmarkedEvents([]);
          setIsLoading(false);
          return;
        }

        // Fetch the actual events
        const eventsFilter: NDKFilter = {
          kinds: [20],
          ids: eventIds,
        };

        const events = await ndk.fetchEvents(eventsFilter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });

        // Convert Set to Array and sort by creation date
        const eventsArray = Array.from(events).sort(
          (a, b) => (b.created_at || 0) - (a.created_at || 0),
        );

        setBookmarkedEvents(eventsArray);
      } catch (error) {
        console.error("Error fetching bookmarks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookmarks();
  }, [ndk, loggedInUser]);

  if (!loggedInUser) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-lg">Please log in to view your bookmarks</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (bookmarkedEvents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-lg">No bookmarks yet</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="mb-4 text-2xl font-bold">Your Bookmarks</h1>
      {bookmarkedEvents.map((event) => (
        <ImagePost key={event.id} event={event} />
      ))}
    </div>
  );
};
