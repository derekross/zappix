// src/pages/ProfilePage.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { nip19 } from "nostr-tools";
import { useNdk } from "../contexts/NdkContext";
import {
  NDKEvent,
  NDKFilter,
  NDKKind,
  NDKUser,
  NDKUserProfile,
  NDKSubscriptionCacheUsage,
} from "@nostr-dev-kit/ndk";
import { ImagePost } from "../components/ImagePost";
import { ProfileHeader } from "../components/ProfileHeader";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import toast from "react-hot-toast";
import { ProfileEditForm } from "../components/ProfileEditForm";

const POSTS_PER_PAGE = 10;
const IMAGE_POST_KIND: NDKKind = 20;
const CONTACT_LIST_KIND: NDKKind = 3;
// FIX 1: Remove unused MUTE_LIST_KIND
// const MUTE_LIST_KIND: NDKKind = 10000;

export const ProfilePage: React.FC = () => {
  const { ndk, user: loggedInUser, signer, loggedInUserProfile } = useNdk();
  const { npub } = useParams<{ npub: string }>();

  // Profile User State
  const [profileUser, setProfileUser] = useState<NDKUser | null>(null);
  const [profileDetails, setProfileDetails] = useState<NDKUserProfile | null>(
    null
  );
  const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Follow State
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [isLoadingFollowStatus, setIsLoadingFollowStatus] =
    useState<boolean>(false);

  // Profile Posts State
  const [userPosts, setUserPosts] = useState<NDKEvent[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isPostsReachingEnd, setIsPostsReachingEnd] = useState(false);
  const [lastPostTime, setLastPostTime] = useState<number | undefined>(
    undefined
  );
  const initialFetchDoneRef = useRef<Record<string, boolean>>({});

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
    setIsOwnProfile(false);
    setIsEditModalOpen(false);
    setIsLoadingPosts(false);

    const currentNpub = npub || "";
    initialFetchDoneRef.current[currentNpub] = false;

    if (ndk && currentNpub) {
      try {
        const { type, data: pubkey } = nip19.decode(currentNpub);
        if (type === "npub" && typeof pubkey === "string") {
          const userInstance = ndk.getUser({ pubkey });
          setProfileUser(userInstance);
          if (loggedInUser?.pubkey === pubkey) {
            setIsOwnProfile(true);
            setProfileDetails(loggedInUserProfile);
          } else {
            setIsOwnProfile(false);
          }
        } else {
          throw new Error("Invalid npub");
        }
      } catch (error) {
        console.error("Error decoding npub:", error);
        setProfileUser(null);
        setIsLoadingProfile(false);
      }
    } else {
      setProfileUser(null);
      setIsLoadingProfile(false);
    }
  }, [ndk, npub, loggedInUser, loggedInUserProfile]);

  // Effect to fetch profile details (Kind 0)
  useEffect(() => {
    if (profileUser && (!isOwnProfile || (isOwnProfile && !profileDetails))) {
      setIsLoadingProfile(true);
      profileUser
        .fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
        .then((profile) => setProfileDetails(profile))
        .catch(() => toast.error("Failed to load profile details."))
        .finally(() => setIsLoadingProfile(false));
    } else if (!profileUser) {
      setProfileDetails(null);
      setIsLoadingProfile(false);
    } else {
      setIsLoadingProfile(false);
    }
  }, [profileUser, isOwnProfile, profileDetails]);

  // Effect to fetch logged-in user's follow status
  useEffect(() => {
    if (!ndk || !loggedInUser || !profileUser || isOwnProfile) {
      setIsFollowing(false);
      setIsLoadingFollowStatus(false);
      return;
    }
    setIsLoadingFollowStatus(true);
    const authorPubkey = profileUser.pubkey;
    const filter: NDKFilter = {
      kinds: [CONTACT_LIST_KIND],
      authors: [loggedInUser.pubkey],
      limit: 1,
    };
    ndk
      .fetchEvent(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
      .then((contactListEvent) => {
        const foundFollow = !!contactListEvent?.tags.some(
          (t) => t[0] === "p" && t[1] === authorPubkey
        );
        setIsFollowing(foundFollow);
      })
      .catch((err) => {
        console.error("Failed to fetch viewer contact list:", err);
        setIsFollowing(false);
      })
      .finally(() => setIsLoadingFollowStatus(false));
  }, [ndk, loggedInUser, profileUser, isOwnProfile]);

  // Function to fetch profile posts
  const fetchPosts = useCallback(
    async (until?: number) => {
      if (!ndk || !profileUser) return;
      console.log(`Fetching posts for ${profileUser.pubkey}, until: ${until}`);
      setIsLoadingPosts(true);

      const filter: NDKFilter = {
        kinds: [IMAGE_POST_KIND],
        authors: [profileUser.pubkey],
        limit: POSTS_PER_PAGE,
      };
      if (typeof until === "number") {
        filter.until = until;
      }

      try {
        const fetchedEventsSet = await ndk.fetchEvents(filter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        const fetchedEvents = Array.from(fetchedEventsSet);
        const sortedEvents = fetchedEvents.sort(
          (a, b) => b.created_at! - a.created_at!
        );

        if (sortedEvents.length === 0 || sortedEvents.length < POSTS_PER_PAGE) {
          setIsPostsReachingEnd(true);
        } else {
          setIsPostsReachingEnd(false);
        }

        if (sortedEvents.length > 0) {
          const oldestInBatch =
            sortedEvents[sortedEvents.length - 1].created_at!;
          setLastPostTime(oldestInBatch > 0 ? oldestInBatch - 1 : 0);
        }

        setUserPosts((prevPosts) => {
          const existingIds = new Set(prevPosts.map((p) => p.id));
          const newUniquePosts = sortedEvents.filter(
            (p) => !existingIds.has(p.id)
          );
          const updatedPosts =
            until !== undefined
              ? [...prevPosts, ...newUniquePosts]
              : newUniquePosts;
          return updatedPosts.sort((a, b) => b.created_at! - a.created_at!);
        });
      } catch (error) {
        toast.error("Failed to load user posts.");
        console.error("Post fetch error:", error);
        setIsPostsReachingEnd(true);
      } finally {
        setIsLoadingPosts(false);
      }
    },
    [ndk, profileUser]
  );

  // Effect to trigger initial post fetch
  useEffect(() => {
    const currentNpub = npub || "";
    if (
      profileUser &&
      !isLoadingPosts &&
      !initialFetchDoneRef.current[currentNpub]
    ) {
      initialFetchDoneRef.current[currentNpub] = true;
      fetchPosts();
    }
  }, [profileUser, isLoadingPosts, fetchPosts, npub]);

  // Load More Handler
  const loadMorePosts = () => {
    if (isLoadingPosts || isPostsReachingEnd || lastPostTime === undefined) {
      // Check explicitly for undefined
      return;
    }
    fetchPosts(lastPostTime);
  };

  // --- Button Handlers ---
  const handleFollowToggle = async () => {
    if (
      !loggedInUser ||
      !profileUser ||
      !signer ||
      isOwnProfile ||
      isLoadingFollowStatus ||
      !ndk
    )
      return;
    const targetPubkey = profileUser.pubkey;
    const currentlyFollowing = isFollowing;
    setIsLoadingFollowStatus(true);
    try {
      const filter: NDKFilter = {
        kinds: [CONTACT_LIST_KIND],
        authors: [loggedInUser.pubkey],
        limit: 1,
      };
      const currentContactListEvent = await ndk.fetchEvent(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      });
      let currentTags: string[][] = currentContactListEvent?.tags || [];
      let newTags: string[][];
      if (currentlyFollowing) {
        newTags = currentTags.filter(
          (tag) => !(tag[0] === "p" && tag[1] === targetPubkey)
        );
      } else {
        if (
          !currentTags.some((tag) => tag[0] === "p" && tag[1] === targetPubkey)
        ) {
          newTags = [...currentTags, ["p", targetPubkey]];
        } else {
          newTags = currentTags;
        }
      }
      if (
        JSON.stringify(currentTags.sort()) === JSON.stringify(newTags.sort())
      ) {
        // FIX 2: Use base toast() instead of toast.info()
        toast(
          currentlyFollowing ? "Already not following." : "Already following."
        );
        setIsFollowing(currentlyFollowing);
        setIsLoadingFollowStatus(false);
        return;
      }
      const newEvent = new NDKEvent(ndk);
      newEvent.kind = CONTACT_LIST_KIND;
      newEvent.created_at = Math.floor(Date.now() / 1000);
      newEvent.tags = newTags;
      newEvent.content = currentContactListEvent?.content || "";
      await newEvent.sign(signer);
      const publishedRelays = await newEvent.publish();
      if (publishedRelays.size > 0) {
        toast.success(currentlyFollowing ? "Unfollowed!" : "Followed!");
        setIsFollowing(!currentlyFollowing);
      } else {
        toast.error("Failed to publish follow list update.");
      }
    } catch (error) {
      toast.error(`Failed to ${currentlyFollowing ? "unfollow" : "follow"}.`);
      console.error("Follow/Unfollow Error:", error);
    } finally {
      setIsLoadingFollowStatus(false);
    }
  };

  const handleEditProfile = () => {
    if (isOwnProfile) setIsEditModalOpen(true);
  };
  const handleCloseEditModal = () => setIsEditModalOpen(false);
  const handleProfileSave = (updatedProfile: NDKUserProfile) => {
    setProfileDetails(updatedProfile);
    handleCloseEditModal();
  };

  // --- Render Logic ---
  if (isLoadingProfile && !profileDetails && !isOwnProfile) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={150} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="60%" height={40} />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="70%" />
      </Box>
    );
  }
  if (!profileUser && !isLoadingProfile)
    return (
      <Alert severity="error">
        Failed to load profile for {npub}. Invalid NPub?
      </Alert>
    );
  if (profileUser && !profileDetails && !isLoadingProfile && !isOwnProfile)
    return (
      <Alert severity="warning">
        Could not load profile details for {npub}.
      </Alert>
    );

  return (
    <Box>
      {profileUser && (
        <ProfileHeader
          profileDetails={profileDetails}
          profileUser={profileUser}
          isOwnProfile={isOwnProfile}
          isFollowing={isFollowing}
          isLoadingFollowStatus={isLoadingFollowStatus}
          onFollowToggle={handleFollowToggle}
          onEditProfile={handleEditProfile}
        />
      )}

      {/* Post Feed Section */}
      {userPosts.length === 0 && isLoadingPosts && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      )}
      {userPosts.length === 0 &&
        !isLoadingPosts &&
        initialFetchDoneRef.current[npub || ""] && (
          <Typography
            sx={{
              textAlign: "center",
              p: 3,
              color: "text.secondary",
              wordBreak: "break-word",
              overflowWrap: "break-word",
              whiteSpace: "normal", // <--- ensures wrapping
              maxWidth: "100%", // <--- prevents overflow
            }}
          >
            User has no matching image posts.
          </Typography>
        )}

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: { xs: 2, sm: 3 },
          mt: 2,
          width: "100%",
          maxWidth: "100%",
          overflowX: "hidden",
          boxSizing: "border-box",
        }}
      >
        {userPosts.map((event) => (
          <ImagePost key={event.id} event={event} />
        ))}
      </Box>

      {/* Load More Button */}
      {userPosts.length > 0 && !isPostsReachingEnd && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <Button
            variant="contained"
            onClick={loadMorePosts}
            disabled={isLoadingPosts}
          >
            {isLoadingPosts ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Load More Posts"
            )}
          </Button>
        </Box>
      )}
      {/* End of Feed Marker */}
      {userPosts.length > 0 && isPostsReachingEnd && (
        <Typography align="center" color="text.secondary" sx={{ my: 3 }}>
          - End of Feed -
        </Typography>
      )}

      {/* Edit Modal */}
      {isOwnProfile && profileDetails && (
        <ProfileEditForm
          open={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSave={handleProfileSave}
          currentUserProfile={profileDetails}
        />
      )}
      {isOwnProfile && !profileDetails && !isLoadingProfile && (
        <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
          <Button variant="outlined" onClick={handleEditProfile}>
            Edit Your Profile
          </Button>
        </Box>
      )}
    </Box>
  );
};
