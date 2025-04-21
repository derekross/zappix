// src/pages/FollowingFeedPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNdk } from '../contexts/NdkContext';
import { NDKEvent, NDKFilter, NDKKind, NDKUser, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { ImagePost } from '../components/ImagePost';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import toast from 'react-hot-toast';

// Define the kinds and tags we want to see in the feed: Kind 20 with an imeta tag
const FEED_FILTER: NDKFilter = {
    kinds: [20], // Explicitly Kind 20 (not Kind 6)
};
const POSTS_PER_PAGE = 10;

export const FollowingFeedPage: React.FC = () => {
    const { ndk, user } = useNdk();
    const [posts, setPosts] = useState<NDKEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isReachingEnd, setIsReachingEnd] = useState(false);
    const [followedPubkeys, setFollowedPubkeys] = useState<string[] | null>(null);
    const [lastEventTime, setLastEventTime] = useState<number | undefined>(undefined);
    const processingRef = useRef(false);

    // Fetch followed pubkeys (Kind 3)
    useEffect(() => {
        if (!ndk || !user) {
            setFollowedPubkeys(null); setPosts([]); setIsReachingEnd(false); setLastEventTime(undefined);
            return;
        }
        const fetchFollows = async () => {
            console.log("Fetching Kind 3 event for follows list for:", user.pubkey);
            setFollowedPubkeys(null); // Loading state
             try {
                 if (ndk.pool.connectedRelays().size === 0) {
                    await ndk.connect(2000);
                    if (ndk.pool.connectedRelays().size === 0) throw new Error("Failed to connect to relays.");
                 }
                const filter: NDKFilter = { kinds: [3 as NDKKind], authors: [user.pubkey], limit: 1 };
                const latestKind3 = await ndk.fetchEvent(filter, { cacheUsage: NDKSubscriptionCacheUsage.NETWORK_FIRST });
                if (latestKind3) {
                    const pubkeys = latestKind3.tags.filter(t => t[0] === 'p' && t[1]?.length === 64).map(t => t[1]);
                    const uniquePubkeys = Array.from(new Set(pubkeys));
                    setFollowedPubkeys(uniquePubkeys.length > 0 ? uniquePubkeys : []);
                } else {
                    toast.info("Could not find your follows list (Kind 3 event).");
                    setFollowedPubkeys([]);
                }
            } catch (error: any) {
                toast.error(`Error fetching follows: ${error.message}`);
                setFollowedPubkeys([]);
            }
        };
        fetchFollows();
    }, [ndk, user]);

    // Fetch feed based on followed authors & desired kinds
    const fetchFollowingFeed = useCallback(async (until?: number) => {
        if (processingRef.current || !ndk || followedPubkeys === null || isLoading || isReachingEnd) {
             return;
        }
        if (followedPubkeys.length === 0) {
             setIsReachingEnd(true);
             setIsLoading(false); // Stop loading if no follows
             return;
        }
        processingRef.current = true;

        const filter: NDKFilter = {
            ...FEED_FILTER, // Use the base filter (Kind 20)
            limit: POSTS_PER_PAGE,
        };
        // Only add authors filter if there are followed pubkeys
        if (followedPubkeys.length > 0) {
             filter.authors = followedPubkeys;
        }
        if (until) filter.until = until;

        console.log(`Fetching following feed with filter: ${JSON.stringify(filter)}`);
        setIsLoading(true);
        try {
            const fetchedEvents = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
            const sortedEvents = Array.from(fetchedEvents).sort((a, b) => b.created_at! - a.created_at!);
             console.log(`Fetched ${sortedEvents.length} matching events from following.`);
            if (sortedEvents.length === 0 || sortedEvents.length < POSTS_PER_PAGE) {
                setIsReachingEnd(true);
            }
            if (sortedEvents.length > 0) {
                setLastEventTime(sortedEvents[sortedEvents.length - 1].created_at! - 1);
            }
            setPosts(prevPosts => {
                const existingIds = new Set(prevPosts.map(p => p.id));
                const newUniquePosts = sortedEvents.filter(p => !existingIds.has(p.id));
                return [...prevPosts, ...newUniquePosts];
            });
        } catch (error) { 
            toast.error("Failed to fetch posts from following.");
        } finally {
            setIsLoading(false);
            processingRef.current = false;
        }
    }, [ndk, isLoading, isReachingEnd, followedPubkeys]); // Add FEED_FILTER if it were not constant

    useEffect(() => {
        if (followedPubkeys !== null) {
            setPosts([]); setLastEventTime(undefined); setIsReachingEnd(false); processingRef.current = false;
            fetchFollowingFeed();
        }
         return () => { processingRef.current = true; } 
    }, [followedPubkeys]);

    const loadMore = () => { fetchFollowingFeed(lastEventTime); };

    // Render Logic
    if (!user) { return <Alert severity="info">Please log in to see your following feed.</Alert>; }
    if (followedPubkeys === null) { return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /><Typography sx={{ ml: 2 }}>Loading follows...</Typography></Box>;}
     if (followedPubkeys.length === 0) { return <Alert severity="info">Not following anyone or follows list not found.</Alert>; }
    return (
        <Box>
            {posts.length === 0 && isLoading && (
                 <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
            )}
            {posts.length === 0 && !isLoading && isReachingEnd && (
                <Typography sx={{ textAlign: 'center', p: 3 }}>No matching image posts found from the people you follow.</Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
                 {/* ImagePost component will perform its own validation for Kind 20 + imeta */}
                {posts.map(event => (
                    <ImagePost key={event.id} event={event} />
                ))}
            </Box>
            {posts.length > 0 && !isLoading && !isReachingEnd && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <Button variant="contained" onClick={loadMore} disabled={isLoading}>Load More</Button>
                </Box>
            )}
            {isLoading && posts.length > 0 && (
                 <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
            )}
            {isReachingEnd && posts.length > 0 && (
                 <Typography sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>End of feed.</Typography>
            )}
        </Box>
    );
};
