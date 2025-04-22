// /home/raven/zappix/src/pages/FollowingFeedPage.tsx
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
import Alert from "@mui/material/Alert";
import toast from "react-hot-toast";
import useIntersectionObserver from "../hooks/useIntersectionObserver";

const IMAGE_POST_KIND: NDKKind = 20;
const CONTACT_LIST_KIND: NDKKind = 3;
const BATCH_SIZE = 10;

export const FollowingFeedPage: React.FC = () => {
  const { ndk, user } = useNdk();
  const [notes, setNotes] = useState<NDKEvent[]>([]);
  // Rename isLoading to reflect its main purpose: loading posts or initial contacts
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<
    number | undefined
  >(undefined);
  const [followedPubkeys, setFollowedPubkeys] = useState<string[] | null>(null); // null = not loaded yet
  const [error, setError] = useState<string | null>(null);
  const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isMounted = useRef(false);
  const receivedEventIds = useRef(new Set<string>());

  // --- Effect 1: Fetch Follow List ---
  useEffect(() => {
    isMounted.current = true;
    console.log("FollowingFeed: Effect 1 - User/NDK check");
    if (!ndk || !user) {
      console.log("FollowingFeed: Effect 1 - No user/NDK, resetting state");
      setNotes([]);
      setFollowedPubkeys(null);
      setIsLoadingFeed(false); // Not loading if not logged in
      setError(null);
      setCanLoadMore(true);
      return;
    }

    console.log(
      "FollowingFeed: Effect 1 - User/NDK present, resetting state and fetching follows"
    );
    setIsLoadingFeed(true); // Start loading (covers contact fetch initially)
    setError(null);
    setNotes([]);
    setLastEventTimestamp(undefined);
    setCanLoadMore(true);
    setFollowedPubkeys(null); // Mark as loading
    receivedEventIds.current.clear();

    const fetchFollows = async () => {
      console.log(
        "FollowingFeed: Fetching follow list (Kind 3) for user",
        user.pubkey
      );
      try {
        const filter: NDKFilter = {
          kinds: [CONTACT_LIST_KIND],
          authors: [user.pubkey],
          limit: 1,
        };
        const contactListEvent = await ndk.fetchEvent(filter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });

        if (!isMounted.current) return;

        if (contactListEvent) {
          const pubkeys = contactListEvent.tags
            .filter((tag) => tag[0] === "p" && tag[1])
            .map((tag) => tag[1]);
          console.log(
            `FollowingFeed: Found ${pubkeys.length} followed pubkeys.`
          );
          setFollowedPubkeys(pubkeys); // Set the list (triggers Effect 3)
          // NOTE: Don't set isLoadingFeed false here. Let Effect 3 handle it after post fetch.
        } else {
          console.log(
            "FollowingFeed: No contact list (Kind 3) found for user."
          );
          setFollowedPubkeys([]); // Set empty list (triggers Effect 3)
          // NOTE: Don't set isLoadingFeed false here. Effect 3 will see empty list and stop loading.
        }
      } catch (err: any) {
        if (!isMounted.current) return;
        console.error("FollowingFeed: Error fetching contact list:", err);
        setError("Failed to fetch your follow list.");
        setFollowedPubkeys([]); // Set empty list on error (triggers Effect 3)
        // NOTE: Don't set isLoadingFeed false here. Let Effect 3 handle it.
      }
      // No finally block needed here for isLoadingFeed
    };

    fetchFollows();

    return () => {
      isMounted.current = false;
    };
  }, [ndk, user]); // Dependencies

  // --- Effect 2: Fetch Initial Posts (triggered by followedPubkeys change) ---
  useEffect(() => {
    isMounted.current = true; // Also set on mount for this effect
    // Guard: Only run if NDK exists and follows have been determined (not null)
    if (followedPubkeys === null || !ndk) {
      console.log(
        "FollowingFeed: Effect 2 - Skipping initial post fetch (follows/NDK not ready)"
      );
      return;
    }

    // Guard: If follows list is empty, stop loading and return
    if (followedPubkeys.length === 0) {
      console.log(
        "FollowingFeed: Effect 2 - No follows, stopping load and clearing notes."
      );
      setIsLoadingFeed(false);
      setNotes([]);
      setCanLoadMore(false);
      return;
    }

    // Stop previous subscription if any
    if (subscriptionRef.current) {
      subscriptionRef.current.stop();
    }

    console.log(
      `FollowingFeed: Effect 2 - Fetching initial posts for ${followedPubkeys.length} follows.`
    );
    setIsLoadingFeed(true); // Ensure loading is true for post fetch phase
    setError(null);
    setCanLoadMore(true);
    setNotes([]); // Clear previous notes
    setLastEventTimestamp(undefined);
    receivedEventIds.current.clear();

    const filter: NDKFilter = {
      kinds: [IMAGE_POST_KIND],
      authors: followedPubkeys,
      limit: BATCH_SIZE,
    };
    const sub = ndk.subscribe(filter, { closeOnEose: true });
    subscriptionRef.current = sub;
    const batchEvents: NDKEvent[] = [];

    sub.on("event", (event: NDKEvent) => {
      if (!receivedEventIds.current.has(event.id)) {
        receivedEventIds.current.add(event.id);
        batchEvents.push(event);
      }
    });

    sub.on("eose", () => {
      if (!isMounted.current) return;
      console.log(
        `FollowingFeed: Initial fetch EOSE received. ${batchEvents.length} events collected.`
      );
      const sortedBatch = batchEvents.sort(
        (a, b) => b.created_at! - a.created_at!
      );
      setNotes(sortedBatch);
      if (sortedBatch.length > 0) {
        setLastEventTimestamp(sortedBatch[sortedBatch.length - 1].created_at);
      } else {
        setLastEventTimestamp(undefined);
      }
      setCanLoadMore(batchEvents.length >= BATCH_SIZE);
      setIsLoadingFeed(false); // **** STOP LOADING HERE ****
      setIsFetchingMore(false);
      console.log(
        `FollowingFeed: Initial load finished. isLoadingFeed: false, canLoadMore: ${
          batchEvents.length >= BATCH_SIZE
        }`
      );
    });

    sub.on("closed", () => {
      console.log("FollowingFeed: Initial subscription closed.");
      if (isMounted.current && isLoadingFeed) {
        // Check isLoadingFeed state
        console.log(
          "FollowingFeed: Setting isLoadingFeed false due to early close."
        );
        setIsLoadingFeed(false);
        setIsFetchingMore(false);
        if (notes.length === 0) setCanLoadMore(false); // Assume end if closed early with no notes
      }
    });

    // Cleanup subscription when effect re-runs or component unmounts
    return () => {
      console.log("FollowingFeed: Effect 2 cleanup - stopping subscription");
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
      isMounted.current = false; // Set unmounted on cleanup
    };
  }, [followedPubkeys, ndk]); // Dependencies: trigger when follows list is ready OR NDK changes

  // --- Effect 3: Function to load older events --- (Renamed from Effect 4)
  const loadMoreFollowing = useCallback(async () => {
    // Added !isLoadingFeed check to prevent overlap with initial load
    if (
      isLoadingFeed ||
      isFetchingMore ||
      !canLoadMore ||
      lastEventTimestamp === undefined ||
      !ndk ||
      !user ||
      followedPubkeys === null ||
      followedPubkeys.length === 0
    ) {
      console.log("FollowingFeed: Load more skipped", {
        isLoadingFeed,
        isFetchingMore,
        canLoadMore,
        lastEventTimestamp_is_undefined: lastEventTimestamp === undefined,
      });
      return;
    }

    console.log(
      `FollowingFeed: Loading more events until ${lastEventTimestamp}`
    );
    setIsFetchingMore(true); // Set fetching more state
    setError(null);

    const filter: NDKFilter = {
      kinds: [IMAGE_POST_KIND as NDKKind],
      authors: followedPubkeys,
      limit: BATCH_SIZE,
      until: lastEventTimestamp,
    };

    try {
      const fetchedEventsSet = await ndk.fetchEvents(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        closeOnEose: true,
      });
      const fetchedEventsArray = Array.from(fetchedEventsSet);

      if (!isMounted.current) return;

      console.log(
        `FollowingFeed: Fetched ${fetchedEventsArray.length} raw older events.`
      );

      if (fetchedEventsArray.length > 0) {
        setNotes((prevNotes) => {
          const combinedNotes = [...prevNotes, ...fetchedEventsArray];
          const uniqueNotesMap = new Map<string, NDKEvent>();
          combinedNotes.forEach((note) => {
            if (!uniqueNotesMap.has(note.id)) {
              uniqueNotesMap.set(note.id, note);
            }
          });
          const sortedUniqueNotes = Array.from(uniqueNotesMap.values()).sort(
            (a, b) => b.created_at! - a.created_at!
          );
          const newEventsAddedCount =
            sortedUniqueNotes.length - prevNotes.length;

          if (newEventsAddedCount > 0) {
            console.log(
              `FollowingFeed: Added ${newEventsAddedCount} unique older events.`
            );
            if (sortedUniqueNotes.length > 0) {
              setLastEventTimestamp(
                sortedUniqueNotes[sortedUniqueNotes.length - 1].created_at
              );
            }
          } else {
            console.log(
              "FollowingFeed: No new unique older events added after deduplication."
            );
            if (fetchedEventsArray.length < BATCH_SIZE) setCanLoadMore(false);
          }
          return sortedUniqueNotes;
        });

        if (fetchedEventsArray.length < BATCH_SIZE) {
          console.log(
            "FollowingFeed: Fetched less than batch size, setting canLoadMore=false."
          );
          setCanLoadMore(false);
        }
      } else {
        console.log(
          "FollowingFeed: No more older events found (fetch returned 0)."
        );
        setCanLoadMore(false);
      }
    } catch (err) {
      if (!isMounted.current) return;
      console.error("FollowingFeed: Error fetching more events:", err);
      toast.error("Failed to load older posts.");
      setCanLoadMore(false);
    } finally {
      if (isMounted.current) setIsFetchingMore(false); // Stop fetching more indicator
    }
  }, [
    ndk,
    user,
    notes,
    followedPubkeys,
    lastEventTimestamp,
    isFetchingMore,
    isLoadingFeed,
    canLoadMore,
  ]); // Renamed isLoading

  // --- Effect 4: Setup Intersection Observer --- (Renamed from Effect 5)
  useIntersectionObserver({
    target: loadMoreRef,
    onIntersect: loadMoreFollowing,
    // Use isLoadingFeed here
    enabled:
      !isLoadingFeed &&
      !isFetchingMore &&
      canLoadMore &&
      lastEventTimestamp !== undefined &&
      followedPubkeys !== null &&
      followedPubkeys.length > 0,
  });

  // DEBUG LOGGING before render
  console.log("Rendering FollowingFeed:", {
    isLoading: isLoadingFeed, // Use renamed state
    isFetchingMore,
    userExists: !!user,
    followedPubkeysCount: followedPubkeys?.length,
    notesCount: notes.length,
    canLoadMore,
    error,
  });

  // 6. Render Logic
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
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {" "}
          {error}{" "}
        </Alert>
      )}

      {/* Use isLoadingFeed for initial loading indicator */}
      {(isLoadingFeed || (isFetchingMore && notes.length === 0)) && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>
            {followedPubkeys === null
              ? "Loading contacts..."
              : "Loading posts..."}
          </Typography>
        </Box>
      )}

      {/* Use isLoadingFeed in conditions */}
      {!user && !isLoadingFeed && (
        <Typography sx={{ textAlign: "center", p: 3, color: "text.secondary" }}>
          {" "}
          Please log in to see your following feed.{" "}
        </Typography>
      )}
      {user && !isLoadingFeed && followedPubkeys?.length === 0 && (
        <Typography sx={{ textAlign: "center", p: 3, color: "text.secondary" }}>
          {" "}
          You aren't following anyone yet. Find users to follow!{" "}
        </Typography>
      )}

      {/* Render posts if NOT initial loading AND user exists */}
      {!isLoadingFeed &&
        user &&
        notes.map((note) => <ImagePost key={note.id} event={note} />)}

      {/* No Posts message - use isLoadingFeed */}
      {user &&
        !isLoadingFeed &&
        !isFetchingMore &&
        followedPubkeys &&
        followedPubkeys.length > 0 &&
        notes.length === 0 && (
          <Typography
            sx={{ textAlign: "center", p: 3, color: "text.secondary" }}
          >
            No image posts found from the people you follow yet.
          </Typography>
        )}

      {/* Intersection observer target */}
      <div ref={loadMoreRef} style={{ height: "10px", width: "100%" }} />

      {/* Load More Spinner */}
      {isFetchingMore && notes.length > 0 && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {/* End of Feed Marker - use isLoadingFeed */}
      {!canLoadMore &&
        !isLoadingFeed &&
        !isFetchingMore &&
        notes.length > 0 && (
          <Typography align="center" color="text.secondary" sx={{ my: 3 }}>
            - End of Feed -
          </Typography>
        )}
    </Box>
  );
};
