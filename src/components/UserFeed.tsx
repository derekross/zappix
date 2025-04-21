// src/components/UserFeed.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNdk } from '../contexts/NdkContext';
import { NDKEvent, NDKFilter, NDKKind, NDKUser, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { ImagePost } from './ImagePost'; // Reuse the ImagePost component

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

    // Helper to process events (same logic as in Feed.tsx, maybe abstract later?)
    const processFeedEvents = useCallback((events: NDKEvent[]) => {
        let oldestTs: number | undefined = oldestEventTimestamp;
        let addedNew = false;
        const newUniqueEvents: NDKEvent[] = [];
        events.forEach(event => {
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
            setFeedEvents(prev => [...prev, ...newUniqueEvents].sort((a, b) => b.created_at! - a.created_at!));
            setOldestEventTimestamp(oldestTs);
            if (events.length < USER_FEED_FETCH_LIMIT) { setCanLoadMore(false); } else { setCanLoadMore(true); }
        } else if (events.length < USER_FEED_FETCH_LIMIT) {
            setCanLoadMore(false);
        }
    }, [oldestEventTimestamp]);

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
        // Depend on user.pubkey changing to trigger AFTER the reset effect
        if (!ndk || !user.pubkey) return;

        // Check if we are already loading to prevent race conditions after reset
        if (!isLoadingInitial) setIsLoadingInitial(true);

        console.log(`UserFeed: Fetching initial posts for ${user.pubkey}`);
        setCanLoadMore(true); // Ensure it resets

        const initialFilter: NDKFilter = {
             kinds: [20 as NDKKind],
             authors: [user.pubkey], // Filter by this user only
             limit: USER_FEED_FETCH_LIMIT,
        };

        ndk.fetchEvents(initialFilter, { closeOnEose: true })
            .then((events) => {
                 console.log(`UserFeed: Fetched ${events.length} initial events for ${user.pubkey}.`);
                 // Ensure we haven't switched users while fetching
                 // This check might be redundant if reset effect works reliably
                 if (ndk.getUser({npub: user.npub}).pubkey === user.pubkey) { 
                     processFeedEvents(events);
                 }
            })
            .catch(err => { console.error("UserFeed initial fetch err:", err); setError("Failed initial fetch."); })
            .finally(() => { setIsLoadingInitial(false); });

    // This effect now depends on user.pubkey to refetch when profile changes
    }, [ndk, user.pubkey, processFeedEvents]); // Removed isLoadingInitial from deps


    // Fetch MORE events
    const loadMore = useCallback(async () => {
        if (isLoadingMore || !canLoadMore || !oldestEventTimestamp || !user.pubkey) return;

        console.log(`UserFeed: Loading more posts for ${user.pubkey} older than ${oldestEventTimestamp}`);
        setIsLoadingMore(true); setError(null);

        const olderFilter: NDKFilter = {
            kinds: [20 as NDKKind],
            authors: [user.pubkey],
            limit: USER_FEED_FETCH_LIMIT,
            until: oldestEventTimestamp - 1
        };

        try {
             const events = await ndk.fetchEvents(olderFilter, { closeOnEose: true });
             console.log(`UserFeed: Fetched ${events.length} older events for ${user.pubkey}.`);
             if (events.length === 0) { setCanLoadMore(false); }
             else { processFeedEvents(events); }
        } catch (err) { console.error("UserFeed load more err:", err); setError("Failed load more."); setCanLoadMore(false); }
        finally { setIsLoadingMore(false); }

    }, [ndk, user.pubkey, isLoadingMore, oldestEventTimestamp, canLoadMore, processFeedEvents]);


    // Memoize rendered posts
    const renderedPosts = useMemo(() => {
        return feedEvents.map(event => <ImagePost key={event.id} event={event} />);
    }, [feedEvents]);

    // --- Rendering ---
    if (isLoadingInitial && feedEvents.length === 0) {
        return <p>Loading posts...</p>;
    }
    if (error && feedEvents.length === 0) {
        return <p style={{ color: 'red' }}>Error loading posts: {error}</p>;
    }
     if (feedEvents.length === 0 && !isLoadingInitial) {
         return <p>No image posts found for this user.</p>;
    }

    return (
        <div>
            {error && !isLoadingMore && <p style={{ color: 'red' }}>Error loading more: {error}</p>}
            {renderedPosts}
            {canLoadMore && (
                 <div style={{ textAlign: 'center', margin: '20px' }}>
                     <button onClick={loadMore} disabled={isLoadingMore || isLoadingInitial}>
                         {isLoadingMore ? 'Loading...' : 'Load More Posts'}
                     </button>
                 </div>
            )}
            {!canLoadMore && feedEvents.length > 0 && (
                 <p style={{ textAlign: 'center', color: '#888', margin: '20px' }}>- End of User's Feed -</p>
            )}
        </div>
    );
};