// src/components/Feed.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNdk } from '../contexts/NdkContext';
import { NDKEvent, NDKFilter, NDKKind, NDKUser, NDKSubscriptionCacheUsage, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { ImagePost } from './ImagePost';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';

const FEED_FETCH_LIMIT = 15;
// REMOVED: FeedTypeValue

// REMOVED: FeedProps interface

// Feed component no longer takes props for type/relay
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
    const processFeedEvents = useCallback((events: NDKEvent[], isInitial: boolean) => {
        if (!isMounted.current) return;
        let oldestTs: number | undefined = isInitial ? undefined : oldestEventTimestamp;
        let addedNew = false;
        const newUniqueEvents: NDKEvent[] = [];
        if (isInitial) { receivedEventIds.current.clear(); }
        events.forEach(event => {
            if (!receivedEventIds.current.has(event.id)) {
                receivedEventIds.current.add(event.id); newUniqueEvents.push(event); addedNew = true;
                if (event.created_at && (oldestTs === undefined || event.created_at < oldestTs)) { oldestTs = event.created_at; }
            }
        });
        if (addedNew) {
             setFeedEvents(prev => (isInitial ? newUniqueEvents : [...prev, ...newUniqueEvents]).sort((a, b) => b.created_at! - a.created_at!));
             setOldestEventTimestamp(oldestTs);
             setCanLoadMore(events.length >= FEED_FETCH_LIMIT);
        } else {
            if (isInitial || events.length < FEED_FETCH_LIMIT) { setCanLoadMore(false); }
        }
        if (isInitial && !addedNew) { setCanLoadMore(false); setFeedEvents([]); }
    }, [oldestEventTimestamp]);

    // --- Effect 1: Reset and Fetch Contacts on User Change ---
    useEffect(() => {
        isMounted.current = true;
        console.log(`Feed: User changed ${!!user}. Resetting.`);
        currentFetchId.current++; // Invalidate previous fetches
        setFeedEvents([]);
        setFollowingPubkeys(null); // Mark contacts as not loaded
        receivedEventIds.current.clear();
        setOldestEventTimestamp(undefined);
        setCanLoadMore(true);
        setError(null);
        setIsLoading(true); // Start loading

        if (!user || !ndk) {
             setIsLoading(false); // No user, stop loading
             return; // Exit if no user or ndk
        }

        let isSubscribed = true;
        console.log("Feed: Fetching contacts...");
        ndk.fetchEvent({ kinds: [NDKKind.Contacts], authors: [user.pubkey] }, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST, closeOnEose: true })
            .then(contactListEvent => {
                if (!isSubscribed || !isMounted.current) return;
                const pubkeys = contactListEvent?.tags.filter(t => t[0] === 'p').map(t => t[1]) || [];
                console.log(`Feed: Found ${pubkeys.length} follows.`);
                setFollowingPubkeys(pubkeys); // Setting this triggers Effect 2
                // If no follows, stop loading here as Effect 2 won't fetch
                if (pubkeys.length === 0) {
                    setIsLoading(false);
                    setCanLoadMore(false);
                }
            })
            .catch(err => { if(isSubscribed && isMounted.current) { console.error("Contact fetch err:", err); setError("Failed contact fetch."); setFollowingPubkeys([]); setIsLoading(false); }});
        
        return () => { isMounted.current = false; isSubscribed = false; } // Cleanup

    }, [user, ndk]); // Depend only on user and ndk

     // --- Effect 2: Fetch Initial Posts *after* Contacts are Set ---
     useEffect(() => {
        // Run only when followingPubkeys is set (not null) and NDK is ready
        if (followingPubkeys !== null && ndk) {
             const fetchId = ++currentFetchId.current;
             console.log(`Feed: Contacts ready (count: ${followingPubkeys.length}). Fetching initial posts (ID: ${fetchId}).`);
             setIsLoading(true); // Ensure loading is true for post fetch
             setError(null);
             setCanLoadMore(true);

             if (followingPubkeys.length === 0) {
                 console.log("Feed: No follows, skipping initial post fetch.");
                 setFeedEvents([]); // Ensure feed is empty
                 setCanLoadMore(false);
                 setIsLoading(false); // Stop loading
                 return;
             }

             const filter: NDKFilter = { kinds: [20 as NDKKind], limit: FEED_FETCH_LIMIT, authors: followingPubkeys };
             let isSubscribed = true;

             ndk.fetchEvents(filter, { closeOnEose: true, cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY })
                 .then(events => {
                     if (isMounted.current && fetchId === currentFetchId.current) {
                         processFeedEvents(events, true); // true = isInitial
                     }
                 })
                 .catch(err => { if (isMounted.current && fetchId === currentFetchId.current) { setError(`Failed initial fetch: ${err.message || 'Unknown'}`); setFeedEvents([]); setCanLoadMore(false); } })
                 .finally(() => { if (isMounted.current && fetchId === currentFetchId.current) setIsLoading(false); });
            
             return () => { isSubscribed = false; }
        }
     }, [followingPubkeys, ndk, processFeedEvents]); // Trigger when follows list is ready


    // --- Load More Handler ---
    const loadMore = useCallback(async () => {
        // Uses followingPubkeys state here implicitly via dependency
        if (isLoading || !canLoadMore || !oldestEventTimestamp || !ndk || !user || followingPubkeys === null || followingPubkeys.length === 0) return;

        const fetchId = ++currentFetchId.current; 
        console.log(`Feed: Loading more (ID: ${fetchId})`);
        setIsLoading(true); setError(null);

        const filter: NDKFilter = { kinds: [20 as NDKKind], limit: FEED_FETCH_LIMIT, until: oldestEventTimestamp - 1, authors: followingPubkeys };
        let relaySet: NDKRelaySet | undefined = undefined; // Use default relays for load more

        try {
            const events = await ndk.fetchEvents(filter, { closeOnEose: true, cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST }, relaySet);
             if (fetchId === currentFetchId.current && isMounted.current) {
                processFeedEvents(events, false);
             }
        } catch (err: any) { if (fetchId === currentFetchId.current && isMounted.current) { setError(`Load more failed: ${err.message || 'Unknown'}`); setCanLoadMore(false); } }
        finally { if (fetchId === currentFetchId.current && isMounted.current) setIsLoading(false); }

    }, [isLoading, canLoadMore, oldestEventTimestamp, ndk, user, followingPubkeys, processFeedEvents]);


    // Memoize rendered posts
    const renderedPosts = useMemo(() => feedEvents.map(event => <ImagePost key={event.id} event={event} />), [feedEvents]);

    // --- Rendering Logic ---
    if (isLoading && feedEvents.length === 0) { 
        // Distinguish between loading contacts and loading posts
        const loadingText = followingPubkeys === null ? 'Loading contacts...' : 'Loading posts...';
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /><Typography sx={{ml:2}}>{loadingText}</Typography></Box>; 
    }
    if (error && feedEvents.length === 0) { return <Alert severity="error" sx={{m: 2}}>Error loading feed: {error}</Alert>; }
    if (!user) { return <Typography align="center" sx={{mt: 3}}>Please log in to see your feed.</Typography>; }
    if (feedEvents.length === 0 && !isLoading) { 
        let message = `No image posts found from the users you follow.`;
        // Check if follows were loaded (not null) and empty
        if (followingPubkeys !== null && followingPubkeys.length === 0) message = "You aren't following anyone, or they haven't posted images.";
        return <Typography align="center" sx={{mt: 3}}>{message}</Typography>; 
    }

    return (
        <Box>
            {error && !isLoading && feedEvents.length > 0 && <Alert severity="warning" sx={{mb: 2}}>Error loading more: {error}</Alert>}
            {renderedPosts}
            {canLoadMore && (
                 <Box sx={{ textAlign: 'center', margin: '20px' }}>
                     <Button onClick={loadMore} disabled={isLoading} variant="outlined">
                         {isLoading ? <CircularProgress size={24}/> : 'Load More Posts'}
                     </Button>
                 </Box>
            )}
            {!canLoadMore && feedEvents.length > 0 && ( <Typography align="center" color="text.secondary" sx={{my: 3}}>- End of Feed -</Typography> )}
        </Box>
    );
};