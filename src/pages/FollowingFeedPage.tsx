// /home/raven/zappix/src/pages/FollowingFeedPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNdk } from '../contexts/NdkContext';
import { NDKEvent, NDKFilter, NDKSubscription, NDKKind, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { ImagePost } from '../components/ImagePost';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import useIntersectionObserver from '../hooks/useIntersectionObserver';

const IMAGE_POST_KIND = 20;
const CONTACT_LIST_KIND = 3;
const BATCH_SIZE = 10; // Number of events to fetch per batch

export const FollowingFeedPage: React.FC = () => {
    const { ndk, user } = useNdk();
    const [notes, setNotes] = useState<NDKEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [lastEventTimestamp, setLastEventTimestamp] = useState<number | undefined>(undefined);
    const [followedPubkeys, setFollowedPubkeys] = useState<string[] | null>(null); // null initially, empty array if no follows, string array if follows exist
    const [error, setError] = useState<string | null>(null);
    const subscriptionRef = useRef<NDKSubscription | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    // 1. Fetch Follow List (Kind 3)
    useEffect(() => {
        // Reset state when user logs out or ndk changes
        if (!ndk || !user) {
            setNotes([]);
            setFollowedPubkeys(null);
            setIsLoading(true); // Show loading until we know if logged in
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        setNotes([]); // Clear notes when user changes
        setLastEventTimestamp(undefined);

        const fetchFollows = async () => {
            console.log("FollowingFeed: Fetching follow list (Kind 3) for user", user.pubkey);
            try {
                const filter: NDKFilter = {
                    kinds: [CONTACT_LIST_KIND as NDKKind],
                    authors: [user.pubkey],
                    limit: 1,
                };
                const contactListEvent = await ndk.fetchEvent(filter, { cacheUsage: NDKSubscriptionCacheUsage.NETWORK_FIRST });

                if (contactListEvent) {
                    const pubkeys = contactListEvent.tags
                        .filter(tag => tag[0] === 'p' && tag[1]) // Filter for valid 'p' tags
                        .map(tag => tag[1]);
                    
                    if (pubkeys.length > 0) {
                        setFollowedPubkeys(pubkeys);
                        console.log(`FollowingFeed: Found ${pubkeys.length} followed pubkeys.`);
                    } else {
                        setFollowedPubkeys([]); // Set to empty array if contact list exists but has no 'p' tags
                        console.log("FollowingFeed: Found contact list, but no followed pubkeys.");
                    }
                } else {
                    setFollowedPubkeys([]); // Set to empty array if no contact list found
                    console.log("FollowingFeed: No contact list (Kind 3) found for user.");
                }
            } catch (err: any) {
                console.error("FollowingFeed: Error fetching contact list:", err);
                setError("Failed to fetch your follow list. Please try again later.");
                setFollowedPubkeys([]); // Set empty on error to prevent infinite loading
            } finally {
                 // Don't set isLoading false here, wait for subscription EOSE/close
            }
        };

        fetchFollows();

    }, [ndk, user]);

    // 2. Function to subscribe to feed events from followed users
    const subscribeToFollowingFeed = useCallback((until?: number) => {
        // Ensure NDK is ready and we know who the user follows (even if it's an empty list)
        if (!ndk || !user || followedPubkeys === null) {
             console.log("FollowingFeed: Skipping subscription (NDK, user, or followedPubkeys not ready).");
             if (user && followedPubkeys === null) setIsLoading(true); // Keep loading if follows haven't been determined yet
             else setIsLoading(false); // Not logged in or finished checking follows
            return;
        }
        
        // If user follows no one, no need to subscribe
        if (followedPubkeys.length === 0) {
            console.log("FollowingFeed: User follows no one, skipping subscription.");
            setIsLoading(false);
            setNotes([]); // Ensure notes are empty
            return;
        }

        if (subscriptionRef.current) {
            subscriptionRef.current.stop();
        }

        const filter: NDKFilter = {
            kinds: [IMAGE_POST_KIND as NDKKind],
            authors: followedPubkeys, // Filter by followed authors
            limit: BATCH_SIZE,
        };

        if (until) {
            filter.until = until;
        }

        console.log("FollowingFeed: Subscribing with filter:", filter);
        // We typically use fetchEvents for pagination, but subscribe can work for initial load + potential updates
        const newSub = ndk.subscribe(filter, { closeOnEose: true }); // Close on EOSE for initial load
        subscriptionRef.current = newSub;

        newSub.on('event', (event: NDKEvent) => {
            setNotes(prevNotes => {
                if (prevNotes.some(note => note.id === event.id)) {
                    return prevNotes;
                }
                const updatedNotes = [...prevNotes, event].sort((a, b) => b.created_at! - a.created_at!); 
                if (updatedNotes.length > 0) {
                    setLastEventTimestamp(updatedNotes[updatedNotes.length - 1].created_at);
                }
                return updatedNotes;
            });
        });

        newSub.on('eose', () => {
            console.log("FollowingFeed: Subscription EOSE received.");
            setIsLoading(false);
            setIsFetchingMore(false);
            // Subscription closed by closeOnEose: true
        });

        newSub.on('closed', () => {
             console.log("FollowingFeed: Subscription closed.");
             setIsLoading(false); 
             setIsFetchingMore(false);
        });

    }, [ndk, user, followedPubkeys]); 

    // 3. Effect to trigger initial subscription when follows are ready
    useEffect(() => {
        // Only subscribe when followedPubkeys is determined (not null)
        if (followedPubkeys !== null) {
            subscribeToFollowingFeed(); // Initial subscription without 'until'
        }

        // Cleanup function
        return () => {
            if (subscriptionRef.current) {
                console.log("FollowingFeed: Stopping subscription on unmount/dependency change.");
                subscriptionRef.current.stop();
                subscriptionRef.current = null;
            }
        };
    }, [subscribeToFollowingFeed, followedPubkeys]); // Rerun if subscribe function changes or follows are loaded

    // 4. Function to load older events using fetchEvents
    const loadMoreFollowing = useCallback(() => {
        if (isFetchingMore || !lastEventTimestamp || !ndk || !user || followedPubkeys === null || followedPubkeys.length === 0) return;

        console.log(`FollowingFeed: Loading more events until ${lastEventTimestamp}`);
        setIsFetchingMore(true);
        
        const filter: NDKFilter = {
            kinds: [IMAGE_POST_KIND as NDKKind],
            authors: followedPubkeys,
            limit: BATCH_SIZE,
            until: lastEventTimestamp, // Fetch events older than the last one we have
        };

        ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.ONLY_NETWORK }) // Force network fetch for pagination
            .then(fetchedEvents => {
                const uniqueNewEvents = Array.from(fetchedEvents).filter(newEvent => 
                    !notes.some(existingNote => existingNote.id === newEvent.id) // Check against current notes state
                );
                
                if (uniqueNewEvents.length > 0) {
                    setNotes(prevNotes => {
                        const updated = [...prevNotes, ...uniqueNewEvents].sort((a, b) => b.created_at! - a.created_at!);
                        setLastEventTimestamp(updated[updated.length - 1].created_at);
                        return updated;
                    });
                    console.log(`FollowingFeed: Loaded ${uniqueNewEvents.length} more events.`);
                } else {
                    console.log("FollowingFeed: No more older events found.");
                    // Maybe set a flag to disable further loading attempts?
                }
            })
            .catch(err => {
                console.error("FollowingFeed: Error fetching more events:", err);
                toast.error("Failed to load older posts.");
            })
            .finally(() => {
                setIsFetchingMore(false);
            });

    }, [ndk, user, notes, followedPubkeys, lastEventTimestamp, isFetchingMore]);

    // 5. Setup Intersection Observer
    useIntersectionObserver({
        target: loadMoreRef,
        onIntersect: loadMoreFollowing,
        enabled: !isLoading && !isFetchingMore && lastEventTimestamp !== undefined && followedPubkeys !== null && followedPubkeys.length > 0,
    });

    // 6. Render Logic
    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: 2 }}>
            {/* Show error if fetching follows failed */}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Show loading indicator while fetching follows or initial posts */}
            {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                </Box>
            )}

            {/* Show message if not loading, logged in, follows determined, but list is empty */}
            {!isLoading && user && followedPubkeys?.length === 0 && (
                <Typography sx={{ textAlign: 'center', p: 3 }}>You are not following anyone yet, or no posts found from the people you follow.</Typography>
            )}
            
            {/* Show message if not logged in */}
            {!user && (
                 <Typography sx={{ textAlign: 'center', p: 3 }}>Please log in to see your following feed.</Typography>
            )}

            {/* Render posts if available */}
            {!isLoading && notes.length > 0 && notes.map(note => (
                <ImagePost key={note.id} event={note} />
            ))}

            {/* Intersection target */}
            <div ref={loadMoreRef} style={{ height: '10px' }} /> 

            {/* Show loading indicator when fetching more posts */}
            {isFetchingMore && (
                 <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                     <CircularProgress size={24} />
                 </Box>
            )}
        </Box>
    );
};
