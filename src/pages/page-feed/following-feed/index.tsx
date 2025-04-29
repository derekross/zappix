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
const CONTACT_LIST_KIND: NDKKind = 3;
const BATCH_SIZE = 10;

export const FollowingFeed: React.FC = () => {
  const { ndk, user } = useNdk();
  const [notes, setNotes] = React.useState<NDKEvent[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = React.useState(true);
  const [isFetchingMore, setIsFetchingMore] = React.useState(false);
  const [lastEventTimestamp, setLastEventTimestamp] = React.useState<undefined | number>(undefined);
  const [followedPubkeys, setFollowedPubkeys] = React.useState<null | string[]>(null); // null = not loaded yet
  const [error, setError] = React.useState<null | string>(null);
  const [canLoadMore, setCanLoadMore] = React.useState<boolean>(true);
  const subscriptionRef = React.useRef<null | NDKSubscription>(null);
  const loadMoreRef = React.useRef<null | HTMLDivElement>(null);
  const isMounted = React.useRef(false);
  const receivedEventIds = React.useRef(new Set<string>());

  React.useEffect(() => {
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
          authors: [user.pubkey],
          kinds: [CONTACT_LIST_KIND],
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

  React.useEffect(() => {
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
      authors: followedPubkeys,
      kinds: [IMAGE_POST_KIND], // Fetch kind 20 posts from followed authors
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

  const loadMoreFollowing = React.useCallback(async () => {
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
      authors: followedPubkeys,
      kinds: [IMAGE_POST_KIND as NDKKind],
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
    } catch {
      if (!isMounted.current) return;
      toast.error("Failed to load older posts.");
      setCanLoadMore(false);
    } finally {
      if (isMounted.current) setIsFetchingMore(false);
    }
  }, [ndk, user, followedPubkeys, lastEventTimestamp, isFetchingMore, isLoadingFeed, canLoadMore]);

  useIntersectionObserver({
    enabled:
      !isLoadingFeed &&
      !isFetchingMore &&
      canLoadMore &&
      lastEventTimestamp !== undefined &&
      followedPubkeys !== null &&
      followedPubkeys.length > 0,
    onIntersect: loadMoreFollowing,
    target: loadMoreRef,
  });

  return (
    <div className="mt-2 flex flex-col gap-2">
      {isLoadingFeed && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center p-3">
          <Alert>
            <Loader />
            <AlertDescription>
              {followedPubkeys === null ? "Loading contacts..." : "Loading posts..."}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {user &&
        !isLoadingFeed &&
        !isFetchingMore &&
        followedPubkeys &&
        followedPubkeys.length > 0 &&
        notes.length === 0 && (
          <Alert>
            <WarningIcon />
            <AlertDescription>
              No image posts found from the people you follow yet.
            </AlertDescription>
          </Alert>
        )}

      {error != null && (
        <Alert>
          <ErrorIcon />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!user && !isLoadingFeed && (
        <Alert>
          <InfoIcon />
          <AlertDescription>Please log in to see your following feed.</AlertDescription>
        </Alert>
      )}

      {user && !isLoadingFeed && followedPubkeys?.length === 0 && (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            You aren't following anyone yet. Find users to follow!
          </AlertDescription>
        </Alert>
      )}

      {!isLoadingFeed && user != null && (
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
