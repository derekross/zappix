// src/pages/ProfilePage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useNdk } from '../contexts/NdkContext';
import { NDKEvent, NDKFilter, NDKKind, NDKUser, NDKUserProfile, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { ImagePost } from '../components/ImagePost';
import { ProfileHeader } from '../components/ProfileHeader'; 
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import toast from 'react-hot-toast';
import { ProfileEditForm } from '../components/ProfileEditForm'; 

const POSTS_PER_PAGE = 10;
const IMAGE_POST_KIND = 20;
const CONTACT_LIST_KIND = 3;

export const ProfilePage: React.FC = () => {
    const { ndk, user: loggedInUser, signer, loggedInUserProfile, fetchNip65Relays } = useNdk();
    const { npub } = useParams<{ npub: string }>();
    const navigate = useNavigate();

    // Profile User State
    const [profileUser, setProfileUser] = useState<NDKUser | null>(null);
    const [profileDetails, setProfileDetails] = useState<NDKUserProfile | null>(null);
    const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    // Follow State
    const [isFollowing, setIsFollowing] = useState<boolean>(false);
    const [isLoadingFollowStatus, setIsLoadingFollowStatus] = useState<boolean>(false);
    const [viewerFollows, setViewerFollows] = useState<Set<string>>(new Set());

    // Profile Posts State
    const [userPosts, setUserPosts] = useState<NDKEvent[]>([]);
    const [isLoadingPosts, setIsLoadingPosts] = useState(false);
    const [isPostsReachingEnd, setIsPostsReachingEnd] = useState(false);
    const [lastPostTime, setLastPostTime] = useState<number | undefined>(undefined);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Effect to decode npub and set profile user instance
    useEffect(() => {
        setIsLoadingProfile(true);
        setIsLoadingFollowStatus(false);
        setIsFollowing(false);
        setProfileDetails(null);
        setUserPosts([]);
        setLastPostTime(undefined);
        setIsPostsReachingEnd(false);
        setViewerFollows(new Set());
        setIsOwnProfile(false);
        setIsEditModalOpen(false);

        if (ndk && npub) {
            try {
                const { type, data: pubkey } = nip19.decode(npub);
                if (type === 'npub' && typeof pubkey === 'string') {
                    const userInstance = ndk.getUser({ pubkey });
                    setProfileUser(userInstance);
                    if (loggedInUser?.pubkey === pubkey) {
                        setIsOwnProfile(true);
                        setProfileDetails(loggedInUserProfile);
                    } else {
                        setIsOwnProfile(false);
                    }
                } else { throw new Error('Invalid npub'); }
            } catch (error) {
                console.error("Error decoding npub:", error);
                setProfileUser(null);
                setIsLoadingProfile(false);
            }
        } else { setIsLoadingProfile(false); }
    }, [ndk, npub, loggedInUser, loggedInUserProfile]);

    // Effect to fetch profile details (Kind 0)
    useEffect(() => {
        if (profileUser && !isOwnProfile) {
            setIsLoadingProfile(true);
            profileUser.fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.NETWORK_FIRST })
                .then(profile => setProfileDetails(profile))
                .catch(error => toast.error("Failed to load profile details."))
                .finally(() => setIsLoadingProfile(false));
        } else if (profileUser && isOwnProfile && !profileDetails) {
             setIsLoadingProfile(true);
            profileUser.fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.NETWORK_FIRST })
                .then(profile => setProfileDetails(profile))
                .catch(error => toast.error("Failed to load profile details."))
                .finally(() => setIsLoadingProfile(false));
        } else if (!profileUser) {
            setProfileDetails(null);
            setIsLoadingProfile(false);
        }
    }, [profileUser, isOwnProfile, profileDetails]);

    // Effect to fetch logged-in user's follow list (Kind 3)
    useEffect(() => {
        if (ndk && loggedInUser && profileUser && !isOwnProfile) {
            setIsLoadingFollowStatus(true);
            // Fetch the raw event to get tags accurately
            const filter: NDKFilter = { kinds: [CONTACT_LIST_KIND], authors: [loggedInUser.pubkey], limit: 1 };
            ndk.fetchEvent(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
                .then(contactListEvent => {
                    let currentFollows = new Set<string>();
                    if (contactListEvent) {
                        currentFollows = new Set(contactListEvent.tags.filter(t => t[0] === 'p' && t[1]).map(t => t[1]));
                    }
                    setViewerFollows(currentFollows);
                    setIsFollowing(currentFollows.has(profileUser.pubkey));
                    console.log(`ProfilePage: Viewer follows ${currentFollows.size} users. Following current profile: ${currentFollows.has(profileUser.pubkey)}`);
                })
                .catch(err => {
                    console.error("Failed to fetch viewer contact list:", err);
                    setIsFollowing(false); // Assume not following on error
                    setViewerFollows(new Set());
                })
                .finally(() => setIsLoadingFollowStatus(false));
        } else {
            setIsFollowing(false);
            setViewerFollows(new Set());
            setIsLoadingFollowStatus(false);
        }
    }, [ndk, loggedInUser, profileUser, isOwnProfile]);

    // Function to fetch profile posts
    const fetchPosts = useCallback(async (until?: number) => {
        if (!ndk || !profileUser || isLoadingPosts || isPostsReachingEnd) return;
        setIsLoadingPosts(true);
        const filter: NDKFilter = {
            kinds: [IMAGE_POST_KIND as NDKKind],
            authors: [profileUser.pubkey],
            limit: POSTS_PER_PAGE,
        };
        if (until) filter.until = until;
        try {
            const fetchedEvents = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
            const sortedEvents = Array.from(fetchedEvents).sort((a, b) => b.created_at! - a.created_at!);
            if (sortedEvents.length === 0 || sortedEvents.length < POSTS_PER_PAGE) {
                setIsPostsReachingEnd(true);
            }
            if (sortedEvents.length > 0) {
                setLastPostTime(sortedEvents[sortedEvents.length - 1].created_at! - 1);
            }
            setUserPosts(prevPosts => {
                const existingIds = new Set(prevPosts.map(p => p.id));
                const newUniquePosts = sortedEvents.filter(p => !existingIds.has(p.id));
                return [...prevPosts, ...newUniquePosts].sort((a, b) => b.created_at! - a.created_at!);
            });
        } catch (error) {
            toast.error("Failed to load user posts.");
            console.error("Post fetch error:", error);
        } finally {
            setIsLoadingPosts(false);
        }
    }, [ndk, profileUser, isLoadingPosts, isPostsReachingEnd]);

    // Initial post fetch effect
    useEffect(() => {
        if (profileUser) {
            fetchPosts();
        }
    }, [profileUser, fetchPosts]); 

    const loadMorePosts = () => {
        fetchPosts(lastPostTime);
    };

    // --- Button Handlers ---
    // *** REVISED handleFollowToggle using manual Kind 3 update ***
    const handleFollowToggle = async () => {
        if (!loggedInUser || !profileUser || !signer || isOwnProfile || isLoadingFollowStatus || !ndk) return;

        const targetPubkey = profileUser.pubkey;
        const currentlyFollowing = isFollowing; // Use state determined by useEffect
        
        setIsLoadingFollowStatus(true); // Indicate loading

        try {
            // 1. Fetch user's current contact list event (Kind 3)
            const filter: NDKFilter = { kinds: [CONTACT_LIST_KIND], authors: [loggedInUser.pubkey], limit: 1 };
            // Force network check to ensure we modify the latest version
            const currentContactListEvent = await ndk.fetchEvent(filter, { cacheUsage: NDKSubscriptionCacheUsage.NETWORK_FIRST });
            
            let currentTags: string[][] = [];
            if (currentContactListEvent) {
                currentTags = currentContactListEvent.tags;
            }

            // 2. Modify the tags
            let newTags: string[][] = [];
            if (currentlyFollowing) {
                // Unfollow: Remove the tag for the target user
                newTags = currentTags.filter(tag => !(tag[0] === 'p' && tag[1] === targetPubkey));
                console.log(`Unfollowing ${targetPubkey}. Old tags: ${currentTags.length}, New tags: ${newTags.length}`);
            } else {
                // Follow: Add the tag if it doesn't exist
                if (currentTags.some(tag => tag[0] === 'p' && tag[1] === targetPubkey)) {
                    // Already present? Shouldn't happen based on `isFollowing` state, but good to check.
                    newTags = currentTags;
                    console.log(`Already following ${targetPubkey}, tags unchanged.`);
                } else {
                    newTags = [...currentTags, ['p', targetPubkey]];
                    console.log(`Following ${targetPubkey}. Old tags: ${currentTags.length}, New tags: ${newTags.length}`);
                }
            }

            // 3. Create and publish the new Kind 3 event
            const newEvent = new NDKEvent(ndk);
            newEvent.kind = CONTACT_LIST_KIND;
            newEvent.created_at = Math.floor(Date.now() / 1000);
            newEvent.tags = newTags;
            // Content might be empty or encrypted depending on NIP-02, keep it empty for now
            newEvent.content = currentContactListEvent?.content || ''; 

            await newEvent.sign(signer);
            const publishedRelays = await newEvent.publish();

            if (publishedRelays.size > 0) {
                toast.success(currentlyFollowing ? 'Unfollowed!' : 'Followed!');
                // 4. Update local state
                setIsFollowing(!currentlyFollowing);
                // Update the set used for initial check (though useEffect should refetch anyway)
                setViewerFollows(prev => {
                    const next = new Set(prev);
                    if (currentlyFollowing) next.delete(targetPubkey);
                    else next.add(targetPubkey);
                    return next;
                });
            } else {
                 toast.error("Failed to publish contact list update to relays.");
                 throw new Error("Publish failed");
            }
        } catch (error) {
            toast.error(`Failed to ${currentlyFollowing ? 'unfollow' : 'follow'}.`);
            console.error("Follow/Unfollow Error:", error);
             // No state reversion needed as state is updated only on success
        } finally {
            setIsLoadingFollowStatus(false);
        }
    };

    const handleEditProfile = () => {
        if (isOwnProfile) {
             setIsEditModalOpen(true);
        }
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
    };

    const handleProfileSave = (updatedProfile: NDKUserProfile) => {
        setProfileDetails(updatedProfile);
        handleCloseEditModal();
    };

    // --- Render Logic --- 
    if (!npub) return <Alert severity="error">No profile NPub specified.</Alert>;

    if (isLoadingProfile && !profileDetails) {
        return (
            <Box>
                <Skeleton variant="rectangular" height={150} sx={{ mb: 2 }} />
                <Skeleton variant="text" width="60%" height={40} />
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="70%" />
            </Box>
        );
    }

    if (!profileUser) return <Alert severity="error">Failed to load profile for {npub}. Invalid NPub?</Alert>;

    return (
        <Box>
            <ProfileHeader 
                profileDetails={profileDetails} 
                profileUser={profileUser} 
                isOwnProfile={isOwnProfile} 
                isFollowing={isFollowing}
                isLoadingFollowStatus={isLoadingFollowStatus}
                onFollowToggle={handleFollowToggle}
                onEditProfile={handleEditProfile} 
            />
            
            {userPosts.length === 0 && isLoadingPosts && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
            )}
            {userPosts.length === 0 && !isLoadingPosts && isPostsReachingEnd && (
                <Typography sx={{ textAlign: 'center', p: 3 }}>User has no matching image posts.</Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 }, mt: 2 }}>
                {userPosts.map(event => (
                    <ImagePost key={event.id} event={event} />
                ))}
            </Box>
            {userPosts.length > 0 && !isLoadingPosts && !isPostsReachingEnd && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <Button variant="contained" onClick={loadMorePosts} disabled={isLoadingPosts}>Load More Posts</Button>
                </Box>
            )}
            {isLoadingPosts && userPosts.length > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {isOwnProfile && profileDetails && (
                <ProfileEditForm 
                    open={isEditModalOpen} 
                    onClose={handleCloseEditModal} 
                    onSave={handleProfileSave}
                    currentUserProfile={profileDetails} 
                />
            )}
        </Box>
    );
};
