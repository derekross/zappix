import { NDKEvent, NDKSubscriptionCacheUsage, NDKUserProfile } from "@nostr-dev-kit/ndk";
import * as React from "react";
import { Avatar } from "../ui/avatar";

export type CommentItemProps = {
  commentEvent: NDKEvent;
  ndk: any; // Use 'any' or a more specific NDK type if available and imported
};

export const CommentItem: React.FC<CommentItemProps> = ({ commentEvent, ndk }) => {
  const [authorProfile, setAuthorProfile] = React.useState<null | NDKUserProfile>(null);
  const authorUser = React.useMemo(
    () => ndk.getUser({ pubkey: commentEvent.pubkey }),
    [ndk, commentEvent.pubkey],
  );

  React.useEffect(() => {
    let isMounted = true;
    if (authorUser) {
      authorUser
        .fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
        .then((profile: null | NDKUserProfile) => {
          if (isMounted) {
            setAuthorProfile(profile);
          }
        })
        .catch((err: unknown) => console.error("Failed to fetch comment author profile:", err));
    }
    return () => {
      isMounted = false;
    };
  }, [authorUser]);

  const authorDisplayName =
    authorProfile?.displayName || authorProfile?.name || authorUser.npub.substring(0, 8) + "...";
  const authorAvatarUrl = authorProfile?.image?.startsWith("http")
    ? authorProfile.image
    : undefined;

  return (
    <div className="flex-start flex border-b border-gray-400 pb-1 dark:border-gray-600">
      <Avatar image={authorAvatarUrl} fallback={authorDisplayName?.charAt(0).toUpperCase()} />
      <div className="flex-grow-1">
        <p>
          <span className="text-bold">{authorDisplayName}:</span> {commentEvent.content}
        </p>
      </div>
    </div>
  );
};
