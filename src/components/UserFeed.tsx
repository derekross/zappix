// src/components/UserFeed.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNdk } from "../contexts/NdkContext";
// FIX: Remove unused NDKSubscriptionCacheUsage
import { NDKEvent, NDKFilter, NDKKind, NDKUser } from "@nostr-dev-kit/ndk";
import { ImagePost } from "./ImagePost"; // Reuse the ImagePost component

const USER_FEED_FETCH_LIMIT = 10; // Fetch fewer per batch for user feed?

interface UserFeedProps {
  user: NDKUser; // Pass the NDKUser object of the profile owner
}

export const UserFeed: React.FC<UserFeedProps> = ({ user }) => {
  const { ndk } = useNdk(); // Only need ndk instance here
  const [feedEvents, setFeedEvents] = useState<NDKEvent[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oldestEventTimestamp, setOldestEventTimestamp] = useState<number | undefined>(undefined);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const receivedEventIds = useRef(new Set<string>());

  // Helper to process events
  const processFeedEvents = useCallback(
    (events: NDKEvent[]) => {
      let oldestTs: number | undefined = oldestEventTimestamp;
      let addedNew = false;
      const newUniqueEvents: NDKEvent[] = [];
      events.forEach((event) => {
        if (!receivedEventIds.current.has(event.id)) {
          receivedEventIds.current.add(event.id);
          newUniqueEvents.push(event);
          addedNew = true;
          if (event.created_at && (oldestTs === undefined || event.created_at < oldestTs)) {
            oldestTs = event.created_at;
          }
        }
      });
      if (addedNew) {
        setFeedEvents((prev) =>
          [...prev, ...newUniqueEvents].sort((a, b) => b.created_at! - a.created_at!),
        );
        setOldestEventTimestamp(oldestTs);
        // Update canLoadMore based on whether a full batch of *new* events was added
        setCanLoadMore(newUniqueEvents.length >= USER_FEED_FETCH_LIMIT);
      } else {
        // If no new unique events were found in this batch, assume end is reached
        setCanLoadMore(false);
      }
    },
    [oldestEventTimestamp],
  );

  // Effect to reset feed when the user prop changes
  useEffect(() => {
    console.log(`UserFeed: User changed to ${user.pubkey}, resetting feed.`);
    setFeedEvents([]);
    receivedEventIds.current.clear();
    setOldestEventTimestamp(undefined);
    setIsLoadingInitial(true);
    setCanLoadMore(true);
    setError(null);
  }, [user.pubkey]); // Reset when viewing a different profile

  // Fetch INITIAL batch
  useEffect(() => {
    if (!ndk || !user.pubkey) return;

    // This effect runs *after* the reset effect because user.pubkey changes
    if (!isLoadingInitial) setIsLoadingInitial(true); // Ensure loading state is set

    console.log(`UserFeed: Fetching initial posts for ${user.pubkey}`);
    setCanLoadMore(true);

    const initialFilter: NDKFilter = {
      kinds: [20 as NDKKind], // Kind 20 for images
      authors: [user.pubkey],
      limit: USER_FEED_FETCH_LIMIT,
    };

    ndk
      .fetchEvents(initialFilter) // Removed { closeOnEose: true } as it's default for fetchEvents
      .then((events) => {
        console.log(`UserFeed: Fetched ${events.size} initial events for ${user.pubkey}.`);
        // Ensure we haven't switched users while fetching
        if (ndk?.getUser({ npub: user.npub })?.pubkey === user.pubkey) {
          processFeedEvents(Array.from(events));
        } else {
          console.log("UserFeed: User changed during initial fetch, discarding results.");
        }
      })
      .catch((err) => {
        console.error("UserFeed initial fetch err:", err);
        // Only set error if user hasn't changed mid-fetch
        if (ndk?.getUser({ npub: user.npub })?.pubkey === user.pubkey) {
          setError("Failed to load initial posts.");
        }
      })
      .finally(() => {
        // Only stop loading if user hasn't changed mid-fetch
        if (ndk?.getUser({ npub: user.npub })?.pubkey === user.pubkey) {
          setIsLoadingInitial(false);
        }
      });
  }, [ndk, user.pubkey, processFeedEvents]); // Depends on user.pubkey

  // Fetch MORE events
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !canLoadMore || oldestEventTimestamp === undefined || !user.pubkey || !ndk)
      return;

    console.log(
      `UserFeed: Loading more posts for ${user.pubkey} older than ${oldestEventTimestamp}`,
    );
    setIsLoadingMore(true);
    setError(null);

    const olderFilter: NDKFilter = {
      kinds: [20 as NDKKind],
      authors: [user.pubkey],
      limit: USER_FEED_FETCH_LIMIT,
      // Fetch events strictly older than the oldest we have
      until: oldestEventTimestamp,
    };

    try {
      const eventsSet = await ndk.fetchEvents(olderFilter);
      console.log(`UserFeed: Fetched ${eventsSet.size} older events for ${user.pubkey}.`);
      const eventsArray = Array.from(eventsSet);
      // Process even if empty to potentially set canLoadMore=false
      processFeedEvents(eventsArray);
      // If fetchEvents returned less than requested, assume end is reached
      if (eventsArray.length < USER_FEED_FETCH_LIMIT) {
        setCanLoadMore(false);
      }
    } catch (err) {
      console.error("UserFeed load more err:", err);
      setError("Failed to load more posts.");
      setCanLoadMore(false); // Stop trying if load more fails
    } finally {
      setIsLoadingMore(false);
    }
  }, [ndk, user.pubkey, isLoadingMore, oldestEventTimestamp, canLoadMore, processFeedEvents]);

  // Memoize rendered posts
  const renderedPosts = useMemo(() => {
    return feedEvents.map((event) => <ImagePost key={event.id} event={event} />);
  }, [feedEvents]);

  // --- Rendering ---
  if (isLoadingInitial && feedEvents.length === 0) {
    return <p>Loading posts...</p>; // Or Skeleton components
  }
  if (error && feedEvents.length === 0 && !isLoadingInitial) {
    // Show error only if not loading and no posts rendered
    return <p style={{ color: "red" }}>Error loading posts: {error}</p>;
  }
  if (feedEvents.length === 0 && !isLoadingInitial && !error) {
    // Check error state too
    return <p>No image posts found for this user.</p>;
  }

  return (
    <div>
      {error && !isLoadingMore && feedEvents.length > 0 && (
        <p style={{ color: "red" }}>Error loading more: {error}</p>
      )}{" "}
      {/* Show load more error only if some posts already loaded */}
      {renderedPosts}
      {canLoadMore && (
        <div style={{ textAlign: "center", margin: "20px" }}>
          <button onClick={loadMore} disabled={isLoadingMore || isLoadingInitial}>
            {isLoadingMore ? "Loading..." : "Load More Posts"}
          </button>
        </div>
      )}
      {!canLoadMore && feedEvents.length > 0 && (
        <p style={{ textAlign: "center", color: "#888", margin: "20px" }}>- End of User's Feed -</p>
      )}
    </div>
  );
};
