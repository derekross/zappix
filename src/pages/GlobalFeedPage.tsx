// /home/raven/zappix/src/pages/GlobalFeedPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNdk } from '../contexts/NdkContext';
import { NDKEvent, NDKFilter, NDKSubscription, NDKKind, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { ImagePost } from '../components/ImagePost';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import useIntersectionObserver from '../hooks/useIntersectionObserver';

const IMAGE_POST_KIND = 20;
const BATCH_SIZE = 10; // Number of events to fetch per batch

export const GlobalFeedPage: React.FC = () => {
    const { ndk, user } = useNdk(); // Get user from context
    const [notes, setNotes] = useState<NDKEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [lastEventTimestamp, setLastEventTimestamp] = useState<number | undefined>(undefined);
    const [mutedPubkeys, setMutedPubkeys] = useState<Set<string>>(new Set()); // State for muted pubkeys
    const subscriptionRef = useRef<NDKSubscription | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    // Fetch initial mute list
    useEffect(() => {
        if (!ndk || !user) {
            setMutedPubkeys(new Set()); // Clear mutes if logged out
            return;
        }

        const fetchMuteList = async () => {
            console.log("GlobalFeed: Fetching mute list (Kind 10000) for user", user.pubkey);
            try {
                const muteListEvent = await ndk.fetchEvent(
                    {
                        kinds: [NDKKind.MuteList],
                        authors: [user.pubkey],
                    },
                    { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST } // Use cache first
                );

                if (muteListEvent) {
                    const pubkeys = muteListEvent.tags
                        .filter(tag => tag[0] === 'p' && tag[1]) // Filter for valid 'p' tags
                        .map(tag => tag[1]);
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

    // Function to subscribe to feed events
    const subscribeToFeed = useCallback((until?: number) => {
        if (!ndk) return;
        if (subscriptionRef.current) {
            // console.log("GlobalFeed: Stopping existing subscription before creating new one.");
            subscriptionRef.current.stop();
        }

        const filter: NDKFilter = {
            kinds: [IMAGE_POST_KIND as NDKKind],
            limit: BATCH_SIZE,
        };

        if (until) {
            filter.until = until;
        }

        console.log("GlobalFeed: Subscribing with filter:", filter);
        const newSub = ndk.subscribe(filter, { closeOnEose: false });
        subscriptionRef.current = newSub; // Store the new subscription

        newSub.on('event', (event: NDKEvent) => {
            // **** Mute Filter ****
            if (mutedPubkeys.has(event.pubkey)) {
                // console.log(`GlobalFeed: Skipping event from muted user: ${event.pubkey}`);
                return; 
            }
            // **********************

            setNotes(prevNotes => {
                // Avoid duplicates
                if (prevNotes.some(note => note.id === event.id)) {
                    return prevNotes;
                }
                // Add and sort
                const updatedNotes = [...prevNotes, event].sort((a, b) => b.created_at! - a.created_at!); // Ensure descending order
                // Update the timestamp for the next batch
                if (updatedNotes.length > 0) {
                    setLastEventTimestamp(updatedNotes[updatedNotes.length - 1].created_at);
                }
                return updatedNotes;
            });
        });

        newSub.on('eose', () => {
            console.log("GlobalFeed: Subscription EOSE received.");
            setIsLoading(false);
            setIsFetchingMore(false);
            // Optionally stop subscription if you only want one batch initially?
            // Or keep it running for live updates?
             // For pagination, we often stop after EOSE for the initial load
             // but for live feeds, you might want to keep it open.
             // Let's keep it open for now for potential real-time updates.
             // If we want strict pagination: newSub.stop();
        });

        newSub.on('closed', () => {
             console.log("GlobalFeed: Subscription closed.");
             // Maybe set loading states to false here too?
             setIsLoading(false); 
             setIsFetchingMore(false);
        });

    }, [ndk, mutedPubkeys]); // Re-subscribe if mutedPubkeys change

    // Initial subscription effect
    useEffect(() => {
        setIsLoading(true);
        setNotes([]); // Clear notes on initial load or NDK change
        setLastEventTimestamp(undefined);
        subscribeToFeed(); // Initial subscription without 'until'

        // Cleanup function to stop subscription on unmount
        return () => {
            if (subscriptionRef.current) {
                console.log("GlobalFeed: Stopping subscription on unmount.");
                subscriptionRef.current.stop();
                subscriptionRef.current = null;
            }
        };
    }, [ndk, subscribeToFeed]); // Rerun if NDK instance changes or subscribe function changes

    // Function to load older events
    const loadMore = useCallback(() => {
        if (isFetchingMore || !lastEventTimestamp || !ndk) return;

        console.log(`GlobalFeed: Loading more events until ${lastEventTimestamp}`);
        setIsFetchingMore(true);
        
        const filter: NDKFilter = {
            kinds: [IMAGE_POST_KIND as NDKKind],
            limit: BATCH_SIZE,
            until: lastEventTimestamp, // Fetch events older than the last one we have
        };

        // Use fetchEvents for explicit pagination batch
        ndk.fetchEvents(filter)
            .then(fetchedEvents => {
                const uniqueNewEvents = Array.from(fetchedEvents).filter(newEvent => 
                    !notes.some(existingNote => existingNote.id === newEvent.id) && // Check against current notes state
                    !mutedPubkeys.has(newEvent.pubkey) // **** Apply mute filter here too ****
                );
                
                if (uniqueNewEvents.length > 0) {
                    setNotes(prevNotes => {
                        const updated = [...prevNotes, ...uniqueNewEvents].sort((a, b) => b.created_at! - a.created_at!);
                        setLastEventTimestamp(updated[updated.length - 1].created_at);
                        return updated;
                    });
                    console.log(`GlobalFeed: Loaded ${uniqueNewEvents.length} more events.`);
                } else {
                    console.log("GlobalFeed: No more older events found or all filtered.");
                    // Optionally disable further loading if no new events are found?
                }
            })
            .catch(error => {
                console.error("GlobalFeed: Error fetching more events:", error);
            })
            .finally(() => {
                setIsFetchingMore(false);
            });

    }, [ndk, notes, lastEventTimestamp, isFetchingMore, mutedPubkeys]); // Add mutedPubkeys dependency

    // Setup Intersection Observer for infinite scrolling
    useIntersectionObserver({
        target: loadMoreRef,
        onIntersect: loadMore,
        enabled: !isLoading && !isFetchingMore && lastEventTimestamp !== undefined, // Only observe when ready to load more
    });

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: 2 }}>
            {/* Header removed */}
            {isLoading && notes.length === 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                </Box>
            )}
            {!isLoading && notes.length === 0 && (
                <Typography sx={{ textAlign: 'center', p: 3 }}>No posts found.</Typography>
            )}
            {notes.map(note => (
                <ImagePost key={note.id} event={note} />
            ))}
            <div ref={loadMoreRef} style={{ height: '10px' }} /> {/* Intersection target */}
            {isFetchingMore && (
                 <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                     <CircularProgress size={24} />
                 </Box>
            )}
            {/* Optional explicit load more button */} 
            {/* 
            {!isLoading && !isFetchingMore && lastEventTimestamp && (
                <Button onClick={loadMore} fullWidth>Load More</Button>
            )}
            */}
        </Box>
    );
};
