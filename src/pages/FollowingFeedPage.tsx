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
// FIX 2: Import toast
import toast from "react-hot-toast";
import useIntersectionObserver from "../hooks/useIntersectionObserver";

const IMAGE_POST_KIND: NDKKind = 20;
const CONTACT_LIST_KIND: NDKKind = 3;
const BATCH_SIZE = 10; // Number of events to fetch per batch

export const FollowingFeedPage: React.FC = () => {
  const { ndk, user } = useNdk();
  const [notes, setNotes] = useState<NDKEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<
    number | undefined
  >(undefined);
  const [followedPubkeys, setFollowedPubkeys] = useState<string[] | null>(null); // null initially, empty array if no follows, string array if follows exist
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<NDKSubscription | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch Follow List (Kind 3)
  useEffect(() => {
    if (!ndk || !user) {
      setNotes([]);
      setFollowedPubkeys(null);
      setIsLoading(false); // Not loading if not logged in
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setNotes([]);
    setLastEventTimestamp(undefined);

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
        // FIX 1: Use CACHE_FIRST as RELAY_FIRST failed type check
        const contactListEvent = await ndk.fetchEvent(filter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });

        if (contactListEvent) {
          const pubkeys = contactListEvent.tags
            .filter((tag) => tag[0] === "p" && tag[1])
            .map((tag) => tag[1]);

          if (pubkeys.length > 0) {
            setFollowedPubkeys(pubkeys);
            console.log(
              `FollowingFeed: Found ${pubkeys.length} followed pubkeys.`
            );
          } else {
            setFollowedPubkeys([]);
            console.log(
              "FollowingFeed: Found contact list, but no followed pubkeys."
            );
          }
        } else {
          setFollowedPubkeys([]);
          console.log(
            "FollowingFeed: No contact list (Kind 3) found for user."
          );
        }
      } catch (err: any) {
        console.error("FollowingFeed: Error fetching contact list:", err);
        setError("Failed to fetch your follow list. Please try again later.");
        setFollowedPubkeys([]);
      }
      // Don't set isLoading false here, let subscription handle it
    };

    fetchFollows();
  }, [ndk, user]);

  // 2. Function to subscribe to feed events from followed users (Initial Load)
  const subscribeToFollowingFeed = useCallback(
    (until?: number) => {
      if (!ndk || !user || followedPubkeys === null) {
        console.log(
          "FollowingFeed: Skipping subscription (NDK, user, or followedPubkeys not ready)."
        );
        setIsLoading(followedPubkeys === null); // Keep loading only if follows are still pending
        return;
      }

      if (followedPubkeys.length === 0) {
        console.log(
          "FollowingFeed: User follows no one, skipping subscription."
        );
        setIsLoading(false);
        setNotes([]);
        return;
      }

      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
      }

      const filter: NDKFilter = {
        kinds: [IMAGE_POST_KIND],
        authors: followedPubkeys,
        limit: BATCH_SIZE,
      };

      if (until) {
        filter.until = until;
      }

      console.log("FollowingFeed: Subscribing with filter:", filter);
      const newSub = ndk.subscribe(filter, { closeOnEose: true });
      subscriptionRef.current = newSub;

      const processedEventIds = new Set<string>();

      newSub.on("event", (event: NDKEvent) => {
        if (processedEventIds.has(event.id)) return;
        processedEventIds.add(event.id);

        setNotes((prevNotes) => {
          if (prevNotes.some((note) => note.id === event.id)) {
            return prevNotes;
          }
          return [...prevNotes, event].sort(
            (a, b) => b.created_at! - a.created_at!
          );
        });
      });

      newSub.on("eose", () => {
        console.log("FollowingFeed: Subscription EOSE received.");
        setIsLoading(false);
        setIsFetchingMore(false);
        setNotes((currentNotes) => {
          if (currentNotes.length > 0) {
            setLastEventTimestamp(
              currentNotes[currentNotes.length - 1].created_at
            );
          }
          return currentNotes;
        });
      });

      newSub.on("closed", () => {
        console.log("FollowingFeed: Subscription closed.");
        setIsLoading(false);
        setIsFetchingMore(false);
      });
    },
    [ndk, user, followedPubkeys]
  );

  // 3. Effect to trigger initial subscription when follows are ready
  useEffect(() => {
    if (followedPubkeys !== null) {
      subscribeToFollowingFeed();
    }
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
    };
  }, [subscribeToFollowingFeed, followedPubkeys]);

  // 4. Function to load older events using fetchEvents
  const loadMoreFollowing = useCallback(() => {
    if (
      isFetchingMore ||
      !lastEventTimestamp ||
      !ndk ||
      !user ||
      followedPubkeys === null ||
      followedPubkeys.length === 0
    )
      return;

    console.log(
      `FollowingFeed: Loading more events until ${lastEventTimestamp}`
    );
    setIsFetchingMore(true);

    const filter: NDKFilter = {
      kinds: [IMAGE_POST_KIND],
      authors: followedPubkeys,
      limit: BATCH_SIZE,
      until: lastEventTimestamp,
    };

    // Use CACHE_FIRST or ONLY_RELAY depending on desired behavior for older posts
    ndk
      .fetchEvents(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      })
      .then((fetchedEvents) => {
        const uniqueNewEvents = Array.from(fetchedEvents).filter(
          (newEvent) =>
            !notes.some((existingNote) => existingNote.id === newEvent.id)
        );

        if (uniqueNewEvents.length > 0) {
          setNotes((prevNotes) => {
            const updated = [...prevNotes, ...uniqueNewEvents].sort(
              (a, b) => b.created_at! - a.created_at!
            );
            // Ensure timestamp is updated correctly
            setLastEventTimestamp(updated[updated.length - 1].created_at);
            return updated;
          });
          console.log(
            `FollowingFeed: Loaded ${uniqueNewEvents.length} more events.`
          );
        } else {
          console.log("FollowingFeed: No more older events found.");
        }
      })
      .catch((err) => {
        console.error("FollowingFeed: Error fetching more events:", err);
        // FIX 2: Use imported toast
        toast.error("Failed to load older posts.");
      })
      .finally(() => {
        setIsFetchingMore(false);
      });
  }, [ndk, user, notes, followedPubkeys, lastEventTimestamp, isFetchingMore]);

  // 5. Setup Intersection Observer
  useIntersectionObserver({
    target: loadMoreRef,
    onIntersect: loadMoreFollowing,
    enabled:
      !isLoading &&
      !isFetchingMore &&
      lastEventTimestamp !== undefined &&
      followedPubkeys !== null &&
      followedPubkeys.length > 0,
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
          {error}
        </Alert>
      )}

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && user && followedPubkeys?.length === 0 && (
        <Typography sx={{ textAlign: "center", p: 3, color: "text.secondary" }}>
          You are not following anyone, or no image posts were found from the
          people you follow.
        </Typography>
      )}

      {!user &&
        !isLoading && ( // Ensure loading is false before showing login prompt
          <Typography
            sx={{ textAlign: "center", p: 3, color: "text.secondary" }}
          >
            Please log in to see your following feed.
          </Typography>
        )}

      {/* Render posts only if not loading and user is logged in */}
      {!isLoading &&
        user &&
        notes.map((note) => <ImagePost key={note.id} event={note} />)}

      {/* Conditionally render 'no posts' message only if logged in, follows loaded, and notes are empty */}
      {!isLoading &&
        user &&
        followedPubkeys &&
        followedPubkeys.length > 0 &&
        notes.length === 0 && (
          <Typography
            sx={{ textAlign: "center", p: 3, color: "text.secondary" }}
          >
            No image posts found from the people you follow yet.
          </Typography>
        )}

      <div ref={loadMoreRef} style={{ height: "10px", width: "100%" }} />

      {isFetchingMore && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
};
