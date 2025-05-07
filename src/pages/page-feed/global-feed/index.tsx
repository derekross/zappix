import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ErrorIcon, InfoIcon, Loader, WarningIcon } from "@/components/ui/icons";
import {
  NDKEvent,
  NDKFilter,
  NDKKind,
  NDKSubscription,
  NDKSubscriptionCacheUsage,
} from "@nostr-dev-kit/ndk";
import * as React from "react";
import { toast } from "sonner";
import { ImagePost } from "../../../components/image-post";
import { useNdk } from "../../../contexts/NdkContext";
import useIntersectionObserver from "../../../hooks/useIntersectionObserver";

const IMAGE_POST_KIND: NDKKind = 20;
const BATCH_SIZE = 10;

export const GlobalFeed: React.FC = () => {
  const { ndk, user } = useNdk();
  const [notes, setNotes] = React.useState<NDKEvent[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = React.useState(true);
  const [isFetchingMore, setIsFetchingMore] = React.useState(false);
  const [lastEventTimestamp, setLastEventTimestamp] = React.useState<undefined | number>(undefined);
  const [error, setError] = React.useState<null | string>(null);
  const [canLoadMore, setCanLoadMore] = React.useState<boolean>(true);
  const [mutedPubkeys, setMutedPubkeys] = React.useState<Set<string>>(new Set());
  const subscriptionRef = React.useRef<null | NDKSubscription>(null);
  const loadMoreRef = React.useRef<null | HTMLDivElement>(null);
  const isMounted = React.useRef(false);
  const receivedEventIds = React.useRef(new Set<string>());

  // Fetch initial mute list
  React.useEffect(() => {
    isMounted.current = true;
    if (!ndk || !user) {
      setMutedPubkeys(new Set());
      return;
    }

    const fetchMuteList = async () => {
      try {
        const muteListEvent = await ndk.fetchEvent(
          {
            authors: [user.pubkey],
            kinds: [NDKKind.MuteList],
            limit: 1,
          },
          { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST },
        );

        if (muteListEvent) {
          const pubkeys = muteListEvent.tags
            .filter((tag) => tag[0] === "p" && tag[1])
            .map((tag) => tag[1]);
          setMutedPubkeys(new Set(pubkeys));
        } else {
          setMutedPubkeys(new Set());
        }
      } catch (error) {
        console.error("Error fetching mute list:", error);
        setMutedPubkeys(new Set());
      }
    };

    fetchMuteList();
    return () => {
      isMounted.current = false;
    };
  }, [ndk, user]);

  // Initial subscription effect
  React.useEffect(() => {
    isMounted.current = true;
    setIsLoadingFeed(true);
    setError(null);
    setNotes([]);
    setLastEventTimestamp(undefined);
    setCanLoadMore(true);
    receivedEventIds.current.clear();

    if (!ndk) {
      setIsLoadingFeed(false);
      return;
    }

    if (subscriptionRef.current) {
      subscriptionRef.current.stop();
    }

    const filter: NDKFilter = {
      kinds: [IMAGE_POST_KIND],
      limit: BATCH_SIZE,
    };

    const sub = ndk.subscribe(filter, {
      closeOnEose: true,
      groupable: false, // Don't wait for all relays
    });
    subscriptionRef.current = sub;
    const batchEvents: NDKEvent[] = [];

    // Set a timeout to close the subscription if it takes too long
    const timeoutId = setTimeout(() => {
      if (isMounted.current && isLoadingFeed) {
        if (batchEvents.length > 0) {
          const sortedBatch = batchEvents.sort((a, b) => b.created_at! - a.created_at!);
          setNotes(sortedBatch);
          if (sortedBatch.length > 0) {
            setLastEventTimestamp(sortedBatch[sortedBatch.length - 1].created_at);
          }
          setCanLoadMore(batchEvents.length >= BATCH_SIZE);
        } else {
          setCanLoadMore(false);
        }
        setIsLoadingFeed(false);
        setIsFetchingMore(false);
        if (subscriptionRef.current) {
          subscriptionRef.current.stop();
        }
      }
    }, 5000);

    sub.on("event", (event: NDKEvent) => {
      if (!isMounted.current) return;
      if (!receivedEventIds.current.has(event.id) && !mutedPubkeys.has(event.pubkey)) {
        receivedEventIds.current.add(event.id);
        batchEvents.push(event);
      }
    });

    sub.on("eose", () => {
      if (!isMounted.current) return;
      clearTimeout(timeoutId);
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
        clearTimeout(timeoutId);
        setIsLoadingFeed(false);
        setIsFetchingMore(false);
        if (notes.length === 0) setCanLoadMore(false);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
      isMounted.current = false;
    };
  }, [ndk]);

  // Effect to filter out muted users' posts when mute list changes
  React.useEffect(() => {
    if (notes.length > 0) {
      setNotes((prevNotes) => prevNotes.filter((note) => !mutedPubkeys.has(note.pubkey)));
    }
  }, [mutedPubkeys, notes.length]);

  const loadMoreGlobal = React.useCallback(async () => {
    if (isLoadingFeed || isFetchingMore || !canLoadMore || lastEventTimestamp === undefined || !ndk)
      return;

    setIsFetchingMore(true);
    setError(null);

    const filter: NDKFilter = {
      kinds: [IMAGE_POST_KIND],
      limit: BATCH_SIZE,
      until: lastEventTimestamp,
    };

    try {
      const fetchedEventsSet = await ndk.fetchEvents(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        closeOnEose: true,
      });
      const fetchedEventsArray = Array.from(fetchedEventsSet).filter(
        (event) => !mutedPubkeys.has(event.pubkey),
      );

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
    } catch {
      if (!isMounted.current) return;
      toast.error("Failed to load older posts.");
      setCanLoadMore(false);
    } finally {
      if (isMounted.current) setIsFetchingMore(false);
    }
  }, [ndk, isLoadingFeed, isFetchingMore, canLoadMore, lastEventTimestamp, mutedPubkeys]);

  useIntersectionObserver({
    enabled: !isLoadingFeed && !isFetchingMore && canLoadMore && lastEventTimestamp !== undefined,
    onIntersect: loadMoreGlobal,
    target: loadMoreRef,
  });

  return (
    <div className="mt-2 flex flex-col gap-2">
      {isLoadingFeed && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center p-3">
          <Alert>
            <Loader />
            <AlertDescription>Loading posts...</AlertDescription>
          </Alert>
        </div>
      )}

      {!isLoadingFeed && !isFetchingMore && notes.length === 0 && (
        <Alert>
          <WarningIcon />
          <AlertDescription>No image posts found in the global feed.</AlertDescription>
        </Alert>
      )}

      {error != null && (
        <Alert>
          <ErrorIcon />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoadingFeed && (
        <div className="grid gap-4">
          {notes.map((note) => (
            <ImagePost event={note} key={note.id} />
          ))}
        </div>
      )}

      <div className="h-[10px] w-full" ref={loadMoreRef} />
      {isFetchingMore && (
        <div className="flex justify-center p-2">
          <Loader className="size-12" />
        </div>
      )}

      {!canLoadMore && !isLoadingFeed && !isFetchingMore && notes.length > 0 && (
        <Alert>
          <InfoIcon />
          <AlertDescription>End of feed.</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
