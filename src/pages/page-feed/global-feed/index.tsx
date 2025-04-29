import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader, WarningIcon } from "@/components/ui/icons";
import {
  NDKEvent,
  NDKFilter,
  NDKKind,
  NDKSubscription,
  NDKSubscriptionCacheUsage,
} from "@nostr-dev-kit/ndk";
import * as React from "react";
import { ImagePost } from "../../../components/image-post";
import { useNdk } from "../../../contexts/NdkContext";
import useIntersectionObserver from "../../../hooks/useIntersectionObserver";

const IMAGE_POST_KIND: NDKKind = 20; // Use NDKKind type
//const TEXT_NOTE_KIND: NDKKind = 1; // Needed for filter
const BATCH_SIZE = 10; // Number of events to fetch per batch

export const GlobalFeed: React.FC = () => {
  const { ndk, user } = useNdk(); // Get user and ndk from context
  const [notes, setNotes] = React.useState<NDKEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFetchingMore, setIsFetchingMore] = React.useState(false);
  const [lastEventTimestamp, setLastEventTimestamp] = React.useState<undefined | number>(undefined);
  const [mutedPubkeys, setMutedPubkeys] = React.useState<Set<string>>(new Set()); // State for muted pubkeys
  const subscriptionRef = React.useRef<null | NDKSubscription>(null);
  const loadMoreRef = React.useRef<null | HTMLDivElement>(null);

  // Fetch initial mute list
  React.useEffect(() => {
    if (!ndk || !user) {
      setMutedPubkeys(new Set()); // Clear mutes if logged out
      return;
    }

    const fetchMuteList = async () => {
      console.log("GlobalFeed: Fetching mute list (Kind 10000) for user", user.pubkey);
      try {
        const muteListEvent = await ndk.fetchEvent(
          {
            authors: [user.pubkey],
            kinds: [NDKKind.MuteList],
            limit: 1, // Fetch only the latest
          },
          { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST }, // Use cache first
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
  const subscribeToFeed = React.useCallback(
    (until?: number) => {
      if (!ndk) return;

      // Stop previous subscription if creating a new one (e.g., for pagination)
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
      }

      const filter: NDKFilter = {
        kinds: [IMAGE_POST_KIND], // Only kind 20 for global image feed
        limit: BATCH_SIZE,
      };

      if (until) {
        filter.until = until;
      }

      console.log("GlobalFeed: Subscribing with filter:", filter);
      const newSub = ndk.subscribe(filter, { closeOnEose: true });
      subscriptionRef.current = newSub;

      const processedEventIds = new Set<string>();

      newSub.on("event", (event: NDKEvent) => {
        if (processedEventIds.has(event.id)) return;
        processedEventIds.add(event.id);

        if (mutedPubkeys.has(event.pubkey)) {
          return; // Skip muted user
        }

        setNotes((prevNotes) => {
          if (prevNotes.some((note) => note.id === event.id)) {
            return prevNotes;
          }
          const updatedNotes = [...prevNotes, event].sort((a, b) => b.created_at! - a.created_at!);
          return updatedNotes;
        });
      });

      newSub.on("eose", () => {
        console.log("GlobalFeed: Subscription EOSE received.");
        setIsLoading(false);
        setIsFetchingMore(false);

        setNotes((currentNotes) => {
          if (currentNotes.length > 0) {
            setLastEventTimestamp(currentNotes[currentNotes.length - 1].created_at);
          }
          return currentNotes;
        });
      });

      newSub.on("closed", () => {
        console.log("GlobalFeed: Subscription closed.");
        setIsLoading(false);
        setIsFetchingMore(false);
      });
    },
    [ndk, mutedPubkeys],
  );

  // Initial subscription effect
  React.useEffect(() => {
    setIsLoading(true);
    setNotes([]);
    setLastEventTimestamp(undefined);
    subscribeToFeed();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop();
        subscriptionRef.current = null;
      }
    };
  }, [ndk, subscribeToFeed]);

  // Function to load older events using fetchEvents for explicit pagination
  const loadMore = React.useCallback(() => {
    if (isFetchingMore || !lastEventTimestamp || !ndk) return;

    console.log(`GlobalFeed: Loading more events until ${lastEventTimestamp}`);
    setIsFetchingMore(true);

    const filter: NDKFilter = {
      kinds: [IMAGE_POST_KIND],
      limit: BATCH_SIZE,
      until: lastEventTimestamp,
    };

    ndk
      .fetchEvents(filter)
      .then((fetchedEvents) => {
        const uniqueNewEvents = Array.from(fetchedEvents).filter(
          (newEvent) =>
            !notes.some((existingNote) => existingNote.id === newEvent.id) &&
            !mutedPubkeys.has(newEvent.pubkey),
        );

        if (uniqueNewEvents.length > 0) {
          setNotes((prevNotes) => {
            const updated = [...prevNotes, ...uniqueNewEvents].sort(
              (a, b) => b.created_at! - a.created_at!,
            );
            setLastEventTimestamp(updated[updated.length - 1].created_at);
            return updated;
          });
          console.log(`GlobalFeed: Loaded ${uniqueNewEvents.length} more events.`);
        } else {
          console.log("GlobalFeed: No more older events found or all filtered.");
        }
      })
      .catch((error) => {
        console.error("GlobalFeed: Error fetching more events:", error);
      })
      .finally(() => {
        setIsFetchingMore(false);
      });
  }, [ndk, notes, lastEventTimestamp, isFetchingMore, mutedPubkeys]);

  // Setup Intersection Observer for infinite scrolling
  useIntersectionObserver({
    enabled: !isLoading && !isFetchingMore && lastEventTimestamp !== undefined,
    onIntersect: loadMore,
    target: loadMoreRef,
  });

  return (
    <div className="my-2 flex flex-col gap-2">
      {!isLoading && notes.length === 0 && (
        <Alert>
          <WarningIcon />
          <AlertDescription>No image posts found in the feed.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4">
        {notes.length !== 0 && notes.map((note) => <ImagePost event={note} key={note.id} />)}
      </div>
      <div className="h-[10px] w-full" ref={loadMoreRef} />
      {(isLoading || isFetchingMore) && (
        <Alert>
          <Loader />
          <AlertDescription>Loading posts.</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
