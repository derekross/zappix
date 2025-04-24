// src/components/Feed.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNdk } from "../contexts/NdkContext";
// FIX: Removed unused NDKRelaySet import
import { NDKEvent, NDKFilter, NDKKind, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk";
import { ImagePost } from "./ImagePost";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

const FEED_FETCH_LIMIT = 15;
const IMAGE_POST_KIND: NDKKind = 20;

export const Feed: React.FC = () => {
  const { ndk, user } = useNdk();
  const [feedEvents, setFeedEvents] = useState<NDKEvent[]>([]);
  const [followingPubkeys, setFollowingPubkeys] = useState<string[] | null>(null); // null = not loaded
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [oldestEventTimestamp, setOldestEventTimestamp] = useState<number | undefined>(undefined);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const receivedEventIds = useRef(new Set<string>());
  const isMounted = useRef(false);
  const currentFetchId = useRef(0);

  // --- Process Events Helper ---
  const processFeedEvents = useCallback(
    (events: NDKEvent[], isInitial: boolean) => {
      if (!isMounted.current) return;
      let oldestTs: number | undefined = isInitial ? undefined : oldestEventTimestamp;
      let addedNew = false;
      const newUniqueEvents: NDKEvent[] = [];
      if (isInitial) {
        receivedEventIds.current.clear();
      }
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
          (isInitial ? newUniqueEvents : [...prev, ...newUniqueEvents]).sort(
            (a, b) => b.created_at! - a.created_at!,
          ),
        );
        setOldestEventTimestamp(oldestTs);
        setCanLoadMore(events.length >= FEED_FETCH_LIMIT);
      } else {
        if (isInitial || events.length < FEED_FETCH_LIMIT) {
          setCanLoadMore(false);
        }
      }
      if (isInitial && !addedNew) {
        setCanLoadMore(false);
        setFeedEvents([]);
      }
    },
    [oldestEventTimestamp],
  );

  // --- Effect 1: Reset and Fetch Contacts on User Change ---
  useEffect(() => {
    isMounted.current = true;
    console.log(`Feed: User changed ${!!user}. Resetting.`);
    currentFetchId.current++;
    setFeedEvents([]);
    setFollowingPubkeys(null);
    receivedEventIds.current.clear();
    setOldestEventTimestamp(undefined);
    setCanLoadMore(true);
    setError(null);
    setIsLoading(true);

    if (!user || !ndk) {
      setIsLoading(false);
      return;
    }

    console.log("Feed: Fetching contacts...");
    ndk
      .fetchEvent(
        { kinds: [NDKKind.Contacts], authors: [user.pubkey] },
        { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST, closeOnEose: true },
      )
      .then((contactListEvent) => {
        if (!isMounted.current) return;
        const pubkeys =
          contactListEvent?.tags.filter((t) => t[0] === "p" && t[1]).map((t) => t[1]) || [];
        console.log(`Feed: Found ${pubkeys.length} follows.`);
        setFollowingPubkeys(pubkeys);
        if (pubkeys.length === 0) {
          setIsLoading(false);
          setCanLoadMore(false);
        }
      })
      .catch((err) => {
        if (isMounted.current) {
          console.error("Contact fetch err:", err);
          setError("Failed to load contact list.");
          setFollowingPubkeys([]);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted.current = false;
    };
  }, [user, ndk]);

  // --- Effect 2: Fetch Initial Posts *after* Contacts are Set ---
  useEffect(() => {
    if (followingPubkeys !== null && ndk) {
      const fetchId = ++currentFetchId.current;
      console.log(
        `Feed: Contacts ready (count: ${followingPubkeys.length}). Fetching initial posts (ID: ${fetchId}).`,
      );
      setIsLoading(true);
      setError(null);
      setCanLoadMore(true);

      if (followingPubkeys.length === 0) {
        console.log("Feed: No follows, skipping initial post fetch.");
        setFeedEvents([]);
        setCanLoadMore(false);
        setIsLoading(false);
        return;
      }

      const filter: NDKFilter = {
        kinds: [IMAGE_POST_KIND],
        limit: FEED_FETCH_LIMIT,
        authors: followingPubkeys,
      };

      ndk
        .fetchEvents(filter, {
          closeOnEose: true,
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        })
        .then((events) => {
          if (isMounted.current && fetchId === currentFetchId.current) {
            processFeedEvents(Array.from(events), true);
          }
        })
        .catch((err) => {
          if (isMounted.current && fetchId === currentFetchId.current) {
            setError(`Failed initial fetch: ${err.message || "Unknown"}`);
            setFeedEvents([]);
            setCanLoadMore(false);
          }
        })
        .finally(() => {
          if (isMounted.current && fetchId === currentFetchId.current) setIsLoading(false);
        });
    }
  }, [followingPubkeys, ndk, processFeedEvents]);

  // --- Load More Handler ---
  const loadMore = useCallback(async () => {
    if (
      isLoading ||
      !canLoadMore ||
      oldestEventTimestamp === undefined ||
      !ndk ||
      !user ||
      followingPubkeys === null ||
      followingPubkeys.length === 0
    )
      return;

    const fetchId = ++currentFetchId.current;
    console.log(`Feed: Loading more (ID: ${fetchId}) until ${oldestEventTimestamp}`);
    setIsLoading(true);
    setError(null);

    const filter: NDKFilter = {
      kinds: [IMAGE_POST_KIND],
      limit: FEED_FETCH_LIMIT,
      until: oldestEventTimestamp,
      authors: followingPubkeys,
    };
    // let relaySet: NDKRelaySet | undefined = undefined; // Removed as it wasn't used

    try {
      // Pass undefined for relaySet to use default behavior
      const events = await ndk.fetchEvents(filter, {
        closeOnEose: true,
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      });
      if (fetchId === currentFetchId.current && isMounted.current) {
        processFeedEvents(Array.from(events), false);
      }
    } catch (err: any) {
      if (fetchId === currentFetchId.current && isMounted.current) {
        setError(`Load more failed: ${err.message || "Unknown"}`);
        setCanLoadMore(false);
      }
    } finally {
      if (fetchId === currentFetchId.current && isMounted.current) setIsLoading(false);
    }
  }, [
    isLoading,
    canLoadMore,
    oldestEventTimestamp,
    ndk,
    user,
    followingPubkeys,
    processFeedEvents,
  ]);

  // Memoize rendered posts
  const renderedPosts = useMemo(
    () => feedEvents.map((event) => <ImagePost key={event.id} event={event} />),
    [feedEvents],
  );

  // --- Rendering Logic ---
  if (isLoading && feedEvents.length === 0) {
    const loadingText = followingPubkeys === null ? "Loading contacts..." : "Loading posts...";
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>{loadingText}</Typography>
      </Box>
    );
  }
  if (error && feedEvents.length === 0) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error loading feed: {error}
      </Alert>
    );
  }
  if (!user && !isLoading) {
    return (
      <Typography align="center" sx={{ mt: 3 }}>
        Please log in to see your feed.
      </Typography>
    );
  }
  if (feedEvents.length === 0 && !isLoading) {
    let message = `No image posts found from the users you follow. Explore the global feed!`;
    if (followingPubkeys !== null && followingPubkeys.length === 0)
      message = "You aren't following anyone yet. Find users to follow!";
    return (
      <Typography align="center" sx={{ mt: 3 }}>
        {message}
      </Typography>
    );
  }

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
      {error && !isLoading && feedEvents.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Error loading more: {error}
        </Alert>
      )}
      {renderedPosts}
      {canLoadMore && (
        <Box sx={{ textAlign: "center", margin: "20px" }}>
          <Button onClick={loadMore} disabled={isLoading} variant="outlined">
            {isLoading ? <CircularProgress size={24} /> : "Load More Posts"}
          </Button>
        </Box>
      )}
      {!canLoadMore && feedEvents.length > 0 && (
        <Typography align="center" color="text.secondary" sx={{ my: 3 }}>
          - End of Feed -
        </Typography>
      )}
    </Box>
  );
};
