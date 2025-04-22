// /home/raven/zappix/src/pages/GlobalFeedPage.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNdk } from "../contexts/NdkContext";
import {
  NDKEvent,
  NDKFilter,
  NDKSubscription,
  NDKKind,
  NDKSubscriptionCacheUsage,
} from "@nostr-dev-kit/ndk";
import { ImagePost } from "../components/ImagePost";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
// FIX: Removed unused Button import
// import Button from '@mui/material/Button';
import useIntersectionObserver from "../hooks/useIntersectionObserver";

const IMAGE_POST_KIND: NDKKind = 20; // Use NDKKind type
const BATCH_SIZE = 10; // Number of events to fetch per batch

export const GlobalFeedPage: React.FC = () => {
  const { ndk, user } = useNdk(); // Get user from context
  const [notes, setNotes] = useState<NDKEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<
    number | undefined
  >(undefined);
  const [mutedPubkeys, setMutedPubkeys] = useState<Set<string>>(new Set()); // State for muted pubkeys
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Fetch initial mute list
  useEffect(() => {
    if (!ndk || !user) {
      setMutedPubkeys(new Set()); // Clear mutes if logged out
      return;
    }

    const fetchMuteList = async () => {
      console.log(
        "GlobalFeed: Fetching mute list (Kind 10000) for user",
        user.pubkey
      );
      try {
        const muteListEvent = await ndk.fetchEvent(
          {
            kinds: [NDKKind.MuteList],
            authors: [user.pubkey],
            limit: 1, // Fetch only the latest
          },
          { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST } // Use cache first
        );

        if (muteListEvent) {
          const pubkeys = muteListEvent.tags
            .filter((tag) => tag[0] === "p" && tag[1]) // Filter for valid 'p' tags
            .map((tag) => tag[1]);
          setMutedPubkeys(new Set(pubkeys));
          console.log(`GlobalFeed: Loaded ${pubkeys.length} muted pubkeys.`);
        } else {
          console.log("GlobalFeed: No mute list found for user.");
          setMutedPubkeys(new Set()); // Ensure it's empty if no list found
        }
      } catch (error) {
        console.error("GlobalFeed: Error fetching mute list:", error);
        setMutedPubkeys(new Set()); // Reset on error
      }
    };

    fetchMuteList();
  }, [ndk, user]); // Re-fetch if user changes

  // Function to subscribe to feed events (for initial load and potential live updates)
  const subscribeToFeed = useCallback(
    (until?: number) => {
      if (!ndk) return;

      // Stop previous subscription if creating a new one (e.g., for pagination)
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
      }

      const filter: NDKFilter = {
        kinds: [IMAGE_POST_KIND],
        limit: BATCH_SIZE,
      };

      if (until) {
        filter.until = until;
      }

      console.log("GlobalFeed: Subscribing with filter:", filter);
      // closeOnEose: false - Keep open for live updates initially?
      // closeOnEose: true - Better for strict pagination batches
      const newSub = ndk.subscribe(filter, { closeOnEose: true }); // Close after initial batch loads
      subscriptionRef.current = newSub;

      const processedEventIds = new Set<string>(); // Track events processed in this sub batch

      newSub.on("event", (event: NDKEvent) => {
        if (processedEventIds.has(event.id)) return; // Already processed in this batch
        processedEventIds.add(event.id);

        if (mutedPubkeys.has(event.pubkey)) {
          return; // Skip muted user
        }

        // Update state only if the event is truly new compared to existing notes state
        setNotes((prevNotes) => {
          if (prevNotes.some((note) => note.id === event.id)) {
            return prevNotes;
          }
          // Insert and maintain sort order
          const updatedNotes = [...prevNotes, event].sort(
            (a, b) => b.created_at! - a.created_at!
          );
          // Update timestamp for the next fetch (use the oldest from the *newly added* batch)
          // Note: This might be better handled in the 'eose' or fetchEvents logic
          return updatedNotes;
        });
      });

      newSub.on("eose", () => {
        console.log("GlobalFeed: Subscription EOSE received.");
        setIsLoading(false); // Initial load finished
        setIsFetchingMore(false);

        // Update the timestamp based on the actual received batch
        setNotes((currentNotes) => {
          if (currentNotes.length > 0) {
            // Set timestamp to the oldest note currently displayed
            setLastEventTimestamp(
              currentNotes[currentNotes.length - 1].created_at
            );
          }
          return currentNotes; // Return unchanged notes array
        });
      });

      newSub.on("closed", () => {
        console.log("GlobalFeed: Subscription closed.");
        setIsLoading(false);
        setIsFetchingMore(false);
      });
    },
    [ndk, mutedPubkeys]
  ); // Re-subscribe if mutedPubkeys change

  // Initial subscription effect
  useEffect(() => {
    setIsLoading(true);
    setNotes([]);
    setLastEventTimestamp(undefined);
    subscribeToFeed(); // Initial fetch

    // Cleanup
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
    };
  }, [ndk, subscribeToFeed]); // Rerun if NDK or subscribe function ref changes

  // Function to load older events using fetchEvents for explicit pagination
  const loadMore = useCallback(() => {
    if (isFetchingMore || !lastEventTimestamp || !ndk) return;

    console.log(`GlobalFeed: Loading more events until ${lastEventTimestamp}`);
    setIsFetchingMore(true);

    const filter: NDKFilter = {
      kinds: [IMAGE_POST_KIND],
      limit: BATCH_SIZE,
      until: lastEventTimestamp, // Fetch events created strictly before the last one we have
    };

    ndk
      .fetchEvents(filter)
      .then((fetchedEvents) => {
        const uniqueNewEvents = Array.from(fetchedEvents).filter(
          (newEvent) =>
            !notes.some((existingNote) => existingNote.id === newEvent.id) &&
            !mutedPubkeys.has(newEvent.pubkey)
        );

        if (uniqueNewEvents.length > 0) {
          setNotes((prevNotes) => {
            // Add new events and re-sort
            const updated = [...prevNotes, ...uniqueNewEvents].sort(
              (a, b) => b.created_at! - a.created_at!
            );
            // Update timestamp based on the oldest event in the combined list
            setLastEventTimestamp(updated[updated.length - 1].created_at);
            return updated;
          });
          console.log(
            `GlobalFeed: Loaded ${uniqueNewEvents.length} more events.`
          );
        } else {
          console.log(
            "GlobalFeed: No more older events found or all filtered."
          );
          // Maybe set a "noMorePosts" flag here if needed
        }
      })
      .catch((error) => {
        console.error("GlobalFeed: Error fetching more events:", error);
        // Optionally show a toast message to the user
      })
      .finally(() => {
        setIsFetchingMore(false);
      });
  }, [ndk, notes, lastEventTimestamp, isFetchingMore, mutedPubkeys]);

  // Setup Intersection Observer for infinite scrolling
  useIntersectionObserver({
    target: loadMoreRef,
    onIntersect: loadMore,
    enabled: !isLoading && !isFetchingMore && lastEventTimestamp !== undefined,
  });

  return (
    <Box
      sx={{
        maxWidth: 600,
        mx: "auto",
        mt: 2,
        display: "flex",
        flexDirection: "column",
        gap: { xs: 2, sm: 3 },
      }}
    >
      {" "}
      {/* Apply gap here */}
      {isLoading && notes.length === 0 && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      )}
      {!isLoading && notes.length === 0 && (
        <Typography sx={{ textAlign: "center", p: 3, color: "text.secondary" }}>
          No image posts found in the feed.
        </Typography>
      )}
      {notes.map((note) => (
        // Each ImagePost is now implicitly spaced by the parent Box's gap
        <ImagePost key={note.id} event={note} />
      ))}
      {/* Intersection observer target */}
      <div ref={loadMoreRef} style={{ height: "10px", width: "100%" }} />
      {isFetchingMore && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
};
