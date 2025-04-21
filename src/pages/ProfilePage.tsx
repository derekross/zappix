// src/pages/ProfilePage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useNdk } from '../contexts/NdkContext';
import { NDKEvent, NDKFilter, NDKKind, NDKUser, NDKUserProfile, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { ImagePost } from '../components/ImagePost';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import toast from 'react-hot-toast';
import IconButton from '@mui/material/IconButton'; // Added import for IconButton

const POSTS_PER_PAGE = 10;
// Define the kinds and tags for profile posts: Kind 20
const PROFILE_POST_FILTER: NDKFilter = {
    kinds: [20], // Explicitly Kind 20 (not Kind 6)
};

export const ProfilePage: React.FC = () => {
    const { ndk, user: loggedInUser, signer } = useNdk();
    const { npub } = useParams<{ npub: string }>();
    const navigate = useNavigate();
    const [profileUser, setProfileUser] = useState<NDKUser | null>(null);
    const [profileDetails, setProfileDetails] = useState<NDKUserProfile | null>(null);
    const [userPosts, setUserPosts] = useState<NDKEvent[]>([]);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isLoadingPosts, setIsLoadingPosts] = useState(false);
    const [isPostsReachingEnd, setIsPostsReachingEnd] = useState(false);
    const [lastPostTime, setLastPostTime] = useState<number | undefined>(undefined);
    const [isFollowing, setIsFollowing] = useState<boolean | null>(null);

    useEffect(() => {
        setIsLoadingProfile(true);
        setIsFollowing(null);
        setProfileDetails(null);
        setUserPosts([]);
        setLastPostTime(undefined);
        setIsPostsReachingEnd(false);
        if (ndk && npub) {
            try {
                const { type, data: pubkey } = nip19.decode(npub);
                if (type === 'npub' && typeof pubkey === 'string') {
                    const userInstance = ndk.getUser({ pubkey });
                    setProfileUser(userInstance);
                } else { throw new Error('Invalid npub'); }
            } catch (error) { setProfileUser(null); setIsLoadingProfile(false); }
        } else { setIsLoadingProfile(false); }
    }, [ndk, npub]);

    useEffect(() => {
        if (profileUser) {
            setIsLoadingProfile(true);
            profileUser.fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.NETWORK_FIRST })
                .then(profile => setProfileDetails(profile))
                .catch(error => toast.error("Failed to load profile details."))
                .finally(() => setIsLoadingProfile(false));
        } else { setProfileDetails(null); }
    }, [profileUser]);

    const fetchPosts = useCallback(async (until?: number) => {
        if (!ndk || !profileUser || isLoadingPosts || isPostsReachingEnd) return;
        setIsLoadingPosts(true);
        const filter: NDKFilter = {
            ...PROFILE_POST_FILTER, // Use the base filter (Kind 20, #imeta)
            authors: [profileUser.pubkey],
            limit: POSTS_PER_PAGE,
        };
        if (until) filter.until = until;

        console.log(`ProfilePage: Fetching posts with filter: ${JSON.stringify(filter)}`);

        try {
            const fetchedEvents = await ndk.fetchEvents(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
            const sortedEvents = Array.from(fetchedEvents).sort((a, b) => b.created_at! - a.created_at!);
             console.log(`ProfilePage: Fetched ${sortedEvents.length} matching posts for ${profileUser.pubkey}.`);
            if (sortedEvents.length === 0 || sortedEvents.length < POSTS_PER_PAGE) {
                setIsPostsReachingEnd(true);
            }
            if (sortedEvents.length > 0) {
                setLastPostTime(sortedEvents[sortedEvents.length - 1].created_at! - 1);
            }
            setUserPosts(prevPosts => {
                const existingIds = new Set(prevPosts.map(p => p.id));
                const newUniquePosts = sortedEvents.filter(p => !existingIds.has(p.id));
                return [...prevPosts, ...newUniquePosts];
            });
        } catch (error) {
            toast.error("Failed to load user posts.");
        } finally {
            setIsLoadingPosts(false);
        }
    }, [ndk, profileUser, isLoadingPosts, isPostsReachingEnd]); // Add PROFILE_POST_FILTER if it were not constant

    useEffect(() => {
        if (profileUser) { fetchPosts(); }
    }, [profileUser, fetchPosts]);

    useEffect(() => {
        if (loggedInUser && profileUser && loggedInUser.pubkey !== profileUser.pubkey) {
             setIsFollowing(null);
             loggedInUser.follows({ cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
                .then(followedUsers => setIsFollowing(followedUsers.some(u => u.pubkey === profileUser.pubkey)))
                .catch(err => setIsFollowing(false));
         } else { setIsFollowing(false); }
     }, [loggedInUser, profileUser]);

    const loadMorePosts = () => { fetchPosts(lastPostTime); };

    const handleFollowToggle = async () => {
        if (!loggedInUser || !profileUser || !signer || loggedInUser.pubkey === profileUser.pubkey) return;
        const currentlyFollowing = isFollowing;
        setIsFollowing(null);
        try {
            if (currentlyFollowing) {
                await loggedInUser.unfollow(profileUser, signer);
                toast.success(`Unfollowed`);
                setIsFollowing(false);
            } else {
                await loggedInUser.follow(profileUser, signer);
                toast.success(`Followed`);
                setIsFollowing(true);
            }
        } catch (error) {
            toast.error(`Failed to ${currentlyFollowing ? 'unfollow' : 'follow'}.`);
            setIsFollowing(currentlyFollowing);
        }
    };

    // --- Render Logic --- 
    if (!npub) return <Alert severity="error">No profile NPub specified.</Alert>;
    if (isLoadingProfile && !profileDetails) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;
    if (!profileUser) return <Alert severity="error">Failed to load profile for {npub}. Invalid NPub?</Alert>;

    const displayName = profileDetails?.displayName || profileDetails?.name;
    const displayNpub = profileUser.npub;

    return (
        <Box>
            <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
                 {/* Profile Header */} 
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar src={profileDetails?.image?.startsWith('http') ? profileDetails.image : undefined} alt={displayName || 'Avatar'} sx={{ width: 80, height: 80, mr: 2 }}>{!profileDetails?.image && (displayName?.charAt(0)?.toUpperCase() || 'N')}</Avatar>
                    <Box flexGrow={1}>
                        <Typography variant="h5" fontWeight="bold">{displayName || '-'}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{displayNpub.substring(0, 12)}...{displayNpub.substring(displayNpub.length - 8)}</Typography>
                            <IconButton size="small" onClick={() => { navigator.clipboard.writeText(displayNpub); toast.success('NPub copied!'); }}><ContentCopyIcon fontSize="inherit" /></IconButton>
                        </Box>
                    </Box>
                    {loggedInUser && profileUser && loggedInUser.pubkey !== profileUser.pubkey && (<Button variant={isFollowing ? 'outlined' : 'contained'} onClick={handleFollowToggle} disabled={isFollowing === null}>{isFollowing === null ? <CircularProgress size={20} /> : (isFollowing ? 'Unfollow' : 'Follow')}</Button>)}
                </Box>
                 {/* Profile Details */} 
                {profileDetails?.about && <Typography variant="body1" sx={{ mb: 1 }}>{profileDetails.about}</Typography>}
                 {(profileDetails?.website || profileDetails?.lud16) && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                        {profileDetails?.website?.startsWith('http') && <Chip label="Website" component="a" href={profileDetails.website} target="_blank" clickable size="small" />}
                        {profileDetails?.lud16 && <Chip label={`⚡️ ${profileDetails.lud16}`} size="small" />}
                    </Box>
                 )}
            </Paper>
            {/* User Posts Section */} 
            <Typography variant="h6" gutterBottom>Image Posts (Kind 20 with #imeta)</Typography>
            {userPosts.length === 0 && isLoadingPosts && (<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>)}
             {userPosts.length === 0 && !isLoadingPosts && isPostsReachingEnd && (<Typography sx={{ textAlign: 'center', p: 3 }}>User has no matching image posts.</Typography>)}
             <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
                 {/* ImagePost component will perform its own validation for Kind 20 + imeta */}
                {userPosts.map(event => (<ImagePost key={event.id} event={event} />))}
            </Box>
             {userPosts.length > 0 && !isLoadingPosts && !isPostsReachingEnd && (<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><Button variant="contained" onClick={loadMorePosts} disabled={isLoadingPosts}>Load More Posts</Button></Box>)}
            {isLoadingPosts && userPosts.length > 0 && (<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>)}
        </Box>
    );
};
