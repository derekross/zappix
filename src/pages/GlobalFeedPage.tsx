import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNdk } from '../contexts/NdkContext';
import { NDKEvent, NDKFilter, NDKKind, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { ImagePost } from '../components/ImagePost';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import toast from 'react-hot-toast';

// Define the kinds and tags we want to see in the feed: Kind 20 with an imeta tag
const FEED_FILTER: NDKFilter = {
    kinds: [20], // Explicitly Kind 20 (not Kind 6)
};
const POSTS_PER_PAGE = 10;

export const GlobalFeedPage: React.FC = () => {
    const { ndk } = useNdk();
    const [posts, setPosts] = useState<NDKEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isReachingEnd, setIsReachingEnd] = useState(false);
    const [lastEventTime, setLastEventTime] = useState<number | undefined>(undefined);
    const processingRef = useRef(false);

    const fetchFeed = useCallback(async (until?: number) => {
        if (processingRef.current || !ndk || isLoading || isReachingEnd) return;
        processingRef.current = true;

        const filter: NDKFilter = {
            ...FEED_FILTER, // Use the base filter (Kind 20, #imeta)
            limit: POSTS_PER_PAGE,
        };
        if (until) {
            filter.until = until;
        }

        console.log(`Fetching global feed with filter: ${JSON.stringify(filter)}`);
        setIsLoading(true);

        try {
            const fetchedEvents = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
            const sortedEvents = Array.from(fetchedEvents).sort((a, b) => b.created_at! - a.created_at!);
            console.log(`Fetched ${sortedEvents.length} matching events for Global feed.`);

            if (sortedEvents.length === 0 || sortedEvents.length < POSTS_PER_PAGE) {
                console.log("Reached end of global feed.");
                setIsReachingEnd(true);
            }

            if (sortedEvents.length > 0) {
                const oldestTimestamp = sortedEvents[sortedEvents.length - 1].created_at!;
                setLastEventTime(oldestTimestamp - 1);
            }

            setPosts(prevPosts => {
                const existingIds = new Set(prevPosts.map(p => p.id));
                const newUniquePosts = sortedEvents.filter(p => !existingIds.has(p.id));
                return [...prevPosts, ...newUniquePosts];
            });

        } catch (error) {
            console.error("Error fetching global feed:", error);
            toast.error("Failed to fetch posts.");
        } finally {
            setIsLoading(false);
            processingRef.current = false;
        }
    }, [ndk, isLoading, isReachingEnd]); // Add FEED_FILTER if it were not constant

    useEffect(() => {
        console.log("GlobalFeedPage: Init or NDK change.")
        setPosts([]); setLastEventTime(undefined); setIsReachingEnd(false); processingRef.current = false;
        if (ndk) { fetchFeed(); }
        return () => { processingRef.current = true; } 
    }, [ndk]);

    const loadMore = () => { fetchFeed(lastEventTime); };

    return (
        <Box>
            {posts.length === 0 && isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
            )}
            {posts.length === 0 && !isLoading && isReachingEnd && (
                 <Typography sx={{ textAlign: 'center', p: 3 }}>No matching image posts found.</Typography>
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
