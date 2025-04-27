import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ErrorIcon, Loader, WarningIcon } from "@/components/ui/icons";
import Skeleton from "@mui/material/Skeleton";
import {
  NDKEvent,
  NDKFilter,
  NDKKind,
  NDKSubscriptionCacheUsage,
  NDKUser,
  NDKUserProfile,
} from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import * as React from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { ImagePost } from "../../components/image-post";
import { Button } from "../../components/ui/button";
import { useNdk } from "../../contexts/NdkContext";
import { EditProfileModal } from "./edit-profile-modal";
import { ProfileHeader } from "./profile-header";

const POSTS_PER_PAGE = 10;
const IMAGE_POST_KIND: NDKKind = 20;
const CONTACT_LIST_KIND: NDKKind = 3;
// FIX 1: Remove unused MUTE_LIST_KIND
// const MUTE_LIST_KIND: NDKKind = 10000;

export const ProfilePage: React.FC = () => {
  const { loggedInUserProfile, ndk, signer, user: loggedInUser } = useNdk();
  const { npub } = useParams<{ npub: string }>();

  // Profile User State
  const [profileUser, setProfileUser] = React.useState<null | NDKUser>(null);
  const [profileDetails, setProfileDetails] = React.useState<null | NDKUserProfile>(null);
  const [isOwnProfile, setIsOwnProfile] = React.useState<boolean>(false);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);

  // Follow State
  const [isFollowing, setIsFollowing] = React.useState<boolean>(false);
  const [isLoadingFollowStatus, setIsLoadingFollowStatus] = React.useState<boolean>(false);

  // Profile Posts State
  const [userPosts, setUserPosts] = React.useState<NDKEvent[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = React.useState(false);
  const [isPostsReachingEnd, setIsPostsReachingEnd] = React.useState(false);
  const [lastPostTime, setLastPostTime] = React.useState<undefined | number>(undefined);
  const initialFetchDoneRef = React.useRef<Record<string, boolean>>({});

  // Effect to decode npub and set profile user instance
  React.useEffect(() => {
    setIsLoadingProfile(true);
    setIsLoadingFollowStatus(false);
    setIsFollowing(false);
    setProfileDetails(null);
    setUserPosts([]);
    setLastPostTime(undefined);
    setIsPostsReachingEnd(false);
    setIsOwnProfile(false);
    setIsLoadingPosts(false);

    const currentNpub = npub || "";
    initialFetchDoneRef.current[currentNpub] = false;

    if (ndk && currentNpub) {
      try {
        const { data: pubkey, type } = nip19.decode(currentNpub);
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
  React.useEffect(() => {
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
  React.useEffect(() => {
    if (!ndk || !loggedInUser || !profileUser || isOwnProfile) {
      setIsFollowing(false);
      setIsLoadingFollowStatus(false);
      return;
    }
    setIsLoadingFollowStatus(true);
    const authorPubkey = profileUser.pubkey;
    const filter: NDKFilter = {
      authors: [loggedInUser.pubkey],
      kinds: [CONTACT_LIST_KIND],
      limit: 1,
    };
    ndk
      .fetchEvent(filter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
      .then((contactListEvent) => {
        const foundFollow = !!contactListEvent?.tags.some(
          (t) => t[0] === "p" && t[1] === authorPubkey,
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
  const fetchPosts = React.useCallback(
    async (until?: number) => {
      if (!ndk || !profileUser) return;
      console.log(`Fetching posts for ${profileUser.pubkey}, until: ${until}`);
      setIsLoadingPosts(true);

      const filter: NDKFilter = {
        authors: [profileUser.pubkey],
        kinds: [IMAGE_POST_KIND],
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
        const sortedEvents = fetchedEvents.sort((a, b) => b.created_at! - a.created_at!);

        if (sortedEvents.length === 0 || sortedEvents.length < POSTS_PER_PAGE) {
          setIsPostsReachingEnd(true);
        } else {
          setIsPostsReachingEnd(false);
        }

        if (sortedEvents.length > 0) {
          const oldestInBatch = sortedEvents[sortedEvents.length - 1].created_at!;
          setLastPostTime(oldestInBatch > 0 ? oldestInBatch - 1 : 0);
        }

        setUserPosts((prevPosts) => {
          const existingIds = new Set(prevPosts.map((p) => p.id));
          const newUniquePosts = sortedEvents.filter((p) => !existingIds.has(p.id));
          const updatedPosts =
            until !== undefined ? [...prevPosts, ...newUniquePosts] : newUniquePosts;
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
    [ndk, profileUser],
  );

  // Effect to trigger initial post fetch
  React.useEffect(() => {
    const currentNpub = npub || "";
    if (profileUser && !isLoadingPosts && !initialFetchDoneRef.current[currentNpub]) {
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
    if (!loggedInUser || !profileUser || !signer || isOwnProfile || isLoadingFollowStatus || !ndk)
      return;
    const targetPubkey = profileUser.pubkey;
    const currentlyFollowing = isFollowing;
    setIsLoadingFollowStatus(true);
    try {
      const filter: NDKFilter = {
        authors: [loggedInUser.pubkey],
        kinds: [CONTACT_LIST_KIND],
        limit: 1,
      };
      const currentContactListEvent = await ndk.fetchEvent(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      });
      const currentTags: string[][] = currentContactListEvent?.tags || [];
      let newTags: string[][];
      if (currentlyFollowing) {
        newTags = currentTags.filter((tag) => !(tag[0] === "p" && tag[1] === targetPubkey));
      } else {
        if (!currentTags.some((tag) => tag[0] === "p" && tag[1] === targetPubkey)) {
          newTags = [...currentTags, ["p", targetPubkey]];
        } else {
          newTags = currentTags;
        }
      }
      if (JSON.stringify(currentTags.sort()) === JSON.stringify(newTags.sort())) {
        // FIX 2: Use base toast() instead of toast.info()
        toast(currentlyFollowing ? "Already not following." : "Already following.");
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

  const handleProfileSave = (updatedProfile: NDKUserProfile) => {
    setProfileDetails(updatedProfile);
  };

  // --- Render Logic ---
  if (isLoadingProfile && !profileDetails && !isOwnProfile) {
    return (
      <div>
        <Skeleton height={150} sx={{ mb: 2 }} variant="rectangular" />
        <Skeleton height={40} variant="text" width="60%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="70%" />
      </div>
    );
  }

  if (!profileUser && !isLoadingProfile) {
    return (
      <Alert>
        <ErrorIcon />
        <AlertTitle>Failed to Load Profile</AlertTitle>
        <AlertDescription>Failed to load profile for {npub}. Invalid NPub?</AlertDescription>
      </Alert>
    );
  }

  if (profileUser && !profileDetails && !isLoadingProfile && !isOwnProfile) {
    return (
      <Alert>
        <WarningIcon />
        <AlertTitle>Failed to Load Profile</AlertTitle>
        <AlertDescription>Could not load profile details for {npub}.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {profileUser != null && (
        <ProfileHeader
          isFollowing={isFollowing}
          isLoadingFollowStatus={isLoadingFollowStatus}
          isOwnProfile={isOwnProfile}
          onFollowToggle={handleFollowToggle}
          onProfileSave={handleProfileSave}
          profileDetails={profileDetails}
          profileUser={profileUser}
        />
      )}

      {userPosts.length === 0 && isLoadingPosts && (
        <div className="flex justify-center p-2">
          <Loader />
        </div>
      )}
      {userPosts.length === 0 && !isLoadingPosts && initialFetchDoneRef.current[npub || ""] && (
        <p className="p-2 text-center text-gray-500">User has no matching image posts.</p>
      )}

      <div className="flex w-full flex-col gap-2">
        {userPosts.map((event) => (
          <ImagePost event={event} key={event.id} />
        ))}
      </div>

      {userPosts.length > 0 && !isPostsReachingEnd && (
        <div className="flex justify-center py-4">
          <Button disabled={isLoadingPosts} onClick={loadMorePosts}>
            {isLoadingPosts ? <Loader /> : "Load More Posts"}
          </Button>
        </div>
      )}

      {userPosts.length > 0 && isPostsReachingEnd && (
        <p className="p-2 text-center text-gray-500">- End of Feed -</p>
      )}

      {isOwnProfile && !profileDetails && !isLoadingProfile && (
        <div className="flex justify-center pt-2">
          <EditProfileModal currentUserProfile={profileDetails} onSave={handleProfileSave} />
        </div>
      )}
    </div>
  );
};
