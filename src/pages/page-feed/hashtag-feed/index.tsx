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
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ImagePost } from "../../../components/image-post";
import { useNdk } from "../../../contexts/NdkContext";
import useIntersectionObserver from "../../../hooks/useIntersectionObserver";

const IMAGE_POST_KIND: NDKKind = 20;
const BATCH_SIZE = 10;

const POPULAR_HASHTAGS = ["olas", "olas365", "photography", "foodstr", "art", "travel"];

export const HashtagFeed: React.FC = () => {
  const { ndk } = useNdk();
  const { hashtag } = useParams<{ hashtag: string }>();
  const [notes, setNotes] = React.useState<NDKEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFetchingMore, setIsFetchingMore] = React.useState(false);
  const [lastEventTimestamp, setLastEventTimestamp] = React.useState<undefined | number>(undefined);
  const [canLoadMore, setCanLoadMore] = React.useState(true);
  const loadMoreRef = React.useRef<null | HTMLDivElement>(null);
  const isMounted = React.useRef(false);
  const subscriptionsRef = React.useRef<Map<string, NDKSubscription>>(new Map());

  // Clean hashtag by removing # if present
  const cleanHashtag = hashtag?.startsWith("#") ? hashtag.substring(1) : hashtag;

  const subscribeToFeed = async (tag: string): Promise<() => void> => {
    if (!ndk) return () => {};

    const filter = {
      kinds: [IMAGE_POST_KIND],
      "#t": [tag],
      limit: BATCH_SIZE,
    };

    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    const attemptSubscription = async () => {
      try {
        // Stop any existing subscription for this tag
        const existingSubscription = subscriptionsRef.current.get(tag);
        if (existingSubscription) {
          existingSubscription.stop();
          subscriptionsRef.current.delete(tag);
        }

        const subscription = ndk.subscribe(filter, {
          closeOnEose: false,
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });

        // Store the subscription
        subscriptionsRef.current.set(tag, subscription);

        const events = new Set<NDKEvent>();
        let hasReceivedEvents = false;

        subscription.on("event", (event: NDKEvent) => {
          if (!isMounted.current) return;
          hasReceivedEvents = true;
          events.add(event);
          if (events.size >= BATCH_SIZE) {
            const sortedEvents = Array.from(events).sort((a, b) => b.created_at! - a.created_at!);
            setNotes((prevNotes) => {
              const newNotes = [...prevNotes, ...sortedEvents];
              return Array.from(new Set(newNotes.map((note) => note.id)))
                .map((id) => newNotes.find((note) => note.id === id)!)
                .sort((a, b) => b.created_at! - a.created_at!);
            });
            setLastEventTimestamp(sortedEvents[sortedEvents.length - 1].created_at);
            setIsLoading(false);
          }
        });

        subscription.on("eose", () => {
          if (!isMounted.current) return;
          if (events.size === 0 && !hasReceivedEvents) {
            setCanLoadMore(false);
          }
          setIsLoading(false);
        });

        subscription.on("close", () => {
          if (!isMounted.current) return;
          console.error(`Subscription closed for #${tag}`);
          subscriptionsRef.current.delete(tag);

          // Only retry if we haven't received any events yet
          if (!hasReceivedEvents && retryCount < maxRetries) {
            retryCount++;
            console.log(
              `Retrying subscription for #${tag} (attempt ${retryCount}/${maxRetries})...`,
            );
            setTimeout(attemptSubscription, retryDelay);
          } else if (!hasReceivedEvents) {
            console.error(`Failed to subscribe to #${tag} after ${maxRetries} attempts`);
            toast.error(`Failed to load posts for #${tag}. Please try again later.`);
            setIsLoading(false);
          }
        });

        return () => {
          const sub = subscriptionsRef.current.get(tag);
          if (sub) {
            sub.stop();
            subscriptionsRef.current.delete(tag);
          }
        };
      } catch (error) {
        console.error(`Error creating subscription for #${tag}:`, error);
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying subscription for #${tag} (attempt ${retryCount}/${maxRetries})...`);
          setTimeout(attemptSubscription, retryDelay);
        } else {
          console.error(`Failed to subscribe to #${tag} after ${maxRetries} attempts`);
          toast.error(`Failed to load posts for #${tag}. Please try again later.`);
          setIsLoading(false);
        }
        return () => {};
      }
    };

    return attemptSubscription();
  };

  React.useEffect(() => {
    isMounted.current = true;
    setIsLoading(true);
    setNotes([]);
    setLastEventTimestamp(undefined);
    setCanLoadMore(true);

    let cleanups: (() => void)[] = [];

    const setupSubscriptions = async () => {
      if (cleanHashtag) {
        const cleanup = await subscribeToFeed(cleanHashtag);
        cleanups.push(cleanup);
      } else {
        // If no hashtag is selected, subscribe to all popular hashtags
        const subscriptionPromises = POPULAR_HASHTAGS.map((tag) => subscribeToFeed(tag));
        const cleanupFunctions = await Promise.all(subscriptionPromises);
        cleanups = cleanupFunctions;
      }
    };

    setupSubscriptions();

    return () => {
      isMounted.current = false;
      cleanups.forEach((cleanup) => cleanup());
      // Clean up any remaining subscriptions
      subscriptionsRef.current.forEach((subscription) => {
        subscription.stop();
      });
      subscriptionsRef.current.clear();
    };
  }, [ndk, cleanHashtag]);

  // Function to load older events
  const loadMore = React.useCallback(async () => {
    if (isFetchingMore || !lastEventTimestamp || !ndk || !cleanHashtag) return;

    console.log(
      `HashtagFeed: Loading more events for #${cleanHashtag} until ${lastEventTimestamp}`,
    );
    setIsFetchingMore(true);

    const filter: NDKFilter = {
      kinds: [IMAGE_POST_KIND],
      "#t": [cleanHashtag],
      limit: BATCH_SIZE,
      until: lastEventTimestamp,
    };

    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    const attemptFetch = async () => {
      try {
        const fetchedEvents = await ndk.fetchEvents(filter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        const uniqueNewEvents = Array.from(fetchedEvents).filter(
          (newEvent) => !notes.some((existingNote) => existingNote.id === newEvent.id),
        );

        if (uniqueNewEvents.length > 0) {
          setNotes((prevNotes) => {
            const updated = [...prevNotes, ...uniqueNewEvents].sort(
              (a, b) => b.created_at! - a.created_at!,
            );
            setLastEventTimestamp(updated[updated.length - 1].created_at);
            return updated;
          });
          console.log(
            `HashtagFeed: Loaded ${uniqueNewEvents.length} more events for #${cleanHashtag}`,
          );
        } else {
          console.log(`HashtagFeed: No more events found for #${cleanHashtag}`);
          setCanLoadMore(false);
        }
      } catch (error) {
        console.error(`Error fetching more events for #${cleanHashtag}:`, error);
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(
            `Retrying fetch for #${cleanHashtag} (attempt ${retryCount}/${maxRetries})...`,
          );
          setTimeout(attemptFetch, retryDelay);
        } else {
          toast.error(`Failed to load more posts for #${cleanHashtag}`);
          setCanLoadMore(false);
        }
      } finally {
        setIsFetchingMore(false);
      }
    };

    await attemptFetch();
  }, [ndk, notes, lastEventTimestamp, isFetchingMore, cleanHashtag]);

  // Setup Intersection Observer for infinite scrolling
  useIntersectionObserver({
    enabled: !isLoading && !isFetchingMore && canLoadMore && lastEventTimestamp !== undefined,
    onIntersect: loadMore,
    target: loadMoreRef,
  });

  if (!cleanHashtag) {
    // Create a Set to track which posts we've already shown
    const shownPostIds = new Set<string>();

    return (
      <div className="mt-2">
        <h1 className="mb-6 text-2xl font-bold">Popular Hashtags</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR_HASHTAGS.map((tag) => (
            <div key={tag} className="rounded-lg border shadow-sm">
              <Link
                to={`/feed/hashtag/${tag}`}
                className="text-brand-purple hover:text-brand-purple/80 dark:text-brand-yellow dark:hover:text-brand-yellow/80 block p-4 text-xl font-semibold"
              >
                #{tag}
              </Link>
              <div className="space-y-4">
                {notes
                  .filter((note) => {
                    // Check if the note has this hashtag (case-insensitive)
                    const hasTag = note.tags.some(
                      (t) => t[0] === "t" && t[1].toLowerCase() === tag.toLowerCase(),
                    );
                    // Check if we haven't shown this post yet
                    const isNew = !shownPostIds.has(note.id);
                    // If both conditions are true, add the post ID to our set
                    if (hasTag && isNew) {
                      shownPostIds.add(note.id);
                      return true;
                    }
                    return false;
                  })
                  .slice(0, 3)
                  .map((note) => (
                    <ImagePost key={note.id} event={note} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="my-2 flex flex-col gap-2">
      <h2 className="text-brand-purple dark:text-brand-yellow text-2xl font-bold">
        #{cleanHashtag}
      </h2>

      {!isLoading && notes.length === 0 && (
        <Alert>
          <WarningIcon />
          <AlertDescription>No posts found for #{cleanHashtag}.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {notes.map((note) => (
          <ImagePost event={note} key={note.id} />
        ))}
      </div>

      <div className="h-[10px] w-full" ref={loadMoreRef} />
      {(isLoading || isFetchingMore) && (
        <Alert>
          <Loader />
          <AlertDescription>Loading posts.</AlertDescription>
        </Alert>
      )}

      {!canLoadMore && notes.length > 0 && (
        <Alert>
          <WarningIcon />
          <AlertDescription>End of feed for #{cleanHashtag}.</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
