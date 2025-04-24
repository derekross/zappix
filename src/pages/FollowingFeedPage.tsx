// /home/raven/zappix/src/pages/FollowingFeedPage.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNdk } from "../contexts/NdkContext";
import { useLocation, useNavigate } from "react-router-dom"; // Added imports
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
import Tabs from "@mui/material/Tabs"; // Add Tabs import
import Tab from "@mui/material/Tab"; // Add Tab import
import toast from "react-hot-toast";
import useIntersectionObserver from "../hooks/useIntersectionObserver";

const IMAGE_POST_KIND: NDKKind = 20;
const CONTACT_LIST_KIND: NDKKind = 3;
//const TEXT_NOTE_KIND: NDKKind = 1; // Needed?
const BATCH_SIZE = 10;

export const FollowingFeedPage: React.FC = () => {
  const { ndk, user } = useNdk();
  const navigate = useNavigate();
  const location = useLocation();
  const [notes, setNotes] = useState<NDKEvent[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<number | undefined>(undefined);
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
    if (!ndk || !user) {
      setNotes([]);
      setFollowedPubkeys(null);
      setIsLoadingFeed(false);
      setError(null);
      setCanLoadMore(true);
      return;
    }
    setIsLoadingFeed(true);
    setError(null);
    setNotes([]);
    setLastEventTimestamp(undefined);
    setCanLoadMore(true);
    setFollowedPubkeys(null);
    receivedEventIds.current.clear();

    const fetchFollows = async () => {
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
          setFollowedPubkeys(pubkeys);
        } else {
          setFollowedPubkeys([]);
        }
      } catch (err: any) {
        if (!isMounted.current) return;
        setError("Failed to fetch your follow list.");
        setFollowedPubkeys([]);
      }
    };
    fetchFollows();
    return () => {
      isMounted.current = false;
    };
  }, [ndk, user]);

  // --- Effect 2: Fetch Initial Posts ---
  useEffect(() => {
    isMounted.current = true;
    if (followedPubkeys === null || !ndk) return;
    if (followedPubkeys.length === 0) {
      setIsLoadingFeed(false);
      setNotes([]);
      setCanLoadMore(false);
      return;
    }
    if (subscriptionRef.current) subscriptionRef.current.stop();

    setIsLoadingFeed(true);
    setError(null);
    setCanLoadMore(true);
    setNotes([]);
    setLastEventTimestamp(undefined);
    receivedEventIds.current.clear();

    const filter: NDKFilter = {
      kinds: [IMAGE_POST_KIND], // Fetch kind 20 posts from followed authors
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
      const sortedBatch = batchEvents.sort((a, b) => b.created_at! - a.created_at!);
      setNotes(sortedBatch);
      if (sortedBatch.length > 0) {
        setLastEventTimestamp(sortedBatch[sortedBatch.length - 1].created_at);
      }
      setCanLoadMore(batchEvents.length >= BATCH_SIZE);
      setIsLoadingFeed(false);
      setIsFetchingMore(false);
    });

    sub.on("closed", () => {
      if (isMounted.current && isLoadingFeed) {
        setIsLoadingFeed(false);
        setIsFetchingMore(false);
        if (notes.length === 0) setCanLoadMore(false);
      }
    });

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
      isMounted.current = false;
    };
  }, [followedPubkeys, ndk]);

  // --- Effect 3: Function to load older events ---
  const loadMoreFollowing = useCallback(async () => {
    if (
      isLoadingFeed ||
      isFetchingMore ||
      !canLoadMore ||
      lastEventTimestamp === undefined ||
      !ndk ||
      !user ||
      followedPubkeys === null ||
      followedPubkeys.length === 0
    )
      return;

    setIsFetchingMore(true);
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

      if (fetchedEventsArray.length > 0) {
        setNotes((prevNotes) => {
          const combinedNotes = [...prevNotes, ...fetchedEventsArray];
          const uniqueNotesMap = new Map<string, NDKEvent>();
          combinedNotes.forEach((note) => {
            if (!uniqueNotesMap.has(note.id)) uniqueNotesMap.set(note.id, note);
          });
          const sortedUniqueNotes = Array.from(uniqueNotesMap.values()).sort(
            (a, b) => b.created_at! - a.created_at!,
          );
          const newEventsAddedCount = sortedUniqueNotes.length - prevNotes.length;
          if (newEventsAddedCount > 0 && sortedUniqueNotes.length > 0) {
            setLastEventTimestamp(sortedUniqueNotes[sortedUniqueNotes.length - 1].created_at);
          }
          if (fetchedEventsArray.length < BATCH_SIZE) setCanLoadMore(false);
          return sortedUniqueNotes;
        });
      } else {
        setCanLoadMore(false);
      }
    } catch (err) {
      if (!isMounted.current) return;
      toast.error("Failed to load older posts.");
      setCanLoadMore(false);
    } finally {
      if (isMounted.current) setIsFetchingMore(false);
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
  ]);

  // --- Effect 4: Setup Intersection Observer ---
  useIntersectionObserver({
    target: loadMoreRef,
    onIntersect: loadMoreFollowing,
    enabled:
      !isLoadingFeed &&
      !isFetchingMore &&
      canLoadMore &&
      lastEventTimestamp !== undefined &&
      followedPubkeys !== null &&
      followedPubkeys.length > 0,
  });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    navigate(newValue);
  };

  // 6. Render Logic
  return (
    <>
      {/* Feed Selection Tabs */}
      <Box sx={{ width: "100%", borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={location.pathname} // Use location to determine active tab
          onChange={handleTabChange}
          aria-label="feed selection tabs"
          variant="fullWidth"
        >
          <Tab
            label="Global"
            value="/"
            sx={{
              minWidth: "auto",
              px: { xs: 1, sm: 2 },
              fontSize: { xs: "0.75rem", sm: "0.875rem" },
            }}
          />
          {user && (
            <Tab
              label="Following"
              value="/following"
              sx={{
                minWidth: "auto",
                px: { xs: 1, sm: 2 },
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
              }}
            />
          )}
          {user && (
            <Tab
              label="Local"
              value="/local"
              sx={{
                minWidth: "auto",
                px: { xs: 1, sm: 2 },
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
              }}
            />
          )}
        </Tabs>
      </Box>

      {/* Feed Content Box */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: { xs: 2, sm: 3 },
          mt: 2,
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {(isLoadingFeed || (isFetchingMore && notes.length === 0)) && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>
              {followedPubkeys === null ? "Loading contacts..." : "Loading posts..."}
            </Typography>
          </Box>
        )}

        {!user && !isLoadingFeed && (
          <Typography sx={{ textAlign: "center", p: 3, color: "text.secondary" }}>
            Please log in to see your following feed.
          </Typography>
        )}
        {user && !isLoadingFeed && followedPubkeys?.length === 0 && (
          <Typography
            noWrap={false}
            sx={{
              textAlign: "center",
              p: 3,
              color: "text.secondary",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            You aren't following anyone yet. Find users to follow!
          </Typography>
        )}

        {!isLoadingFeed &&
          user &&
          notes.map((note) => (
            // Render ImagePost directly, relying on its internal styles
            <ImagePost key={note.id} event={note} />
          ))}

        {user &&
          !isLoadingFeed &&
          !isFetchingMore &&
          followedPubkeys &&
          followedPubkeys.length > 0 &&
          notes.length === 0 && (
            <Typography sx={{ textAlign: "center", p: 3, color: "text.secondary" }}>
              No image posts found from the people you follow yet.
            </Typography>
          )}

        {/* Intersection observer target */}
        <div ref={loadMoreRef} style={{ height: "10px", width: "100%" }} />

        {isFetchingMore && notes.length > 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!canLoadMore && !isLoadingFeed && !isFetchingMore && notes.length > 0 && (
          <Typography align="center" color="text.secondary" sx={{ my: 3 }}>
            - End of Feed -
          </Typography>
        )}
      </Box>
    </>
  );
};
