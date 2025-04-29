import { Loader } from "@/components/ui/icons";
import Avatar from "@mui/material/Avatar";
import { NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";
import cx from "classnames";
import { Key, Link, Mail, UserMinus, UserPlus, Zap } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { EditProfileModal } from "./edit-profile-modal";

interface ProfileHeaderProps {
  isFollowing: boolean;
  isLoadingFollowStatus: boolean;
  isOwnProfile: boolean;
  profileDetails: null | NDKUserProfile;
  profileUser: NDKUser;
  onFollowToggle: () => void;
  onProfileSave: (updatedProfile: NDKUserProfile) => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  isFollowing,
  isLoadingFollowStatus,
  isOwnProfile,
  onFollowToggle,
  onProfileSave,
  profileDetails,
  profileUser,
}) => {
  const displayNpub = profileUser.npub;
  const shortNpub = `${displayNpub.substring(0, 10)}...${displayNpub.substring(
    displayNpub.length - 6,
  )}`;
  const displayName = profileDetails?.displayName || profileDetails?.name;
  const bannerUrl = profileDetails?.banner?.startsWith("http") ? profileDetails.banner : undefined;
  const avatarUrl = profileDetails?.image?.startsWith("http") ? profileDetails.image : undefined;
  const nip05 = profileDetails?.nip05;
  const lud16 = profileDetails?.lud16;
  const website = profileDetails?.website?.startsWith("http") ? profileDetails.website : undefined;

  // FIX: Removed unused variable
  // const isNip05Verified = false; // Placeholder

  return (
    <div>
      <div
        className={cx("mb-[-64px] h-[150px] rounded bg-cover bg-position-[center]", {
          "bg-gray-100 dark:bg-gray-800": bannerUrl == null,
        })}
        style={{
          backgroundImage: `url(${bannerUrl})`,
        }}
      />

      <div className="flex flex-col gap-2 py-2">
        <div className="flex items-end justify-between px-2">
          <Avatar
            alt={displayName || "Avatar"}
            className="mt-[-48px] border-2 border-white"
            src={avatarUrl}
            sx={{
              height: 100,
              width: 100,
            }}
          >
            {!avatarUrl && (displayName?.charAt(0)?.toUpperCase() || "N")}
          </Avatar>

          <div className="pb-1">
            {isOwnProfile ? (
              <EditProfileModal currentUserProfile={profileDetails} onSave={onProfileSave} />
            ) : (
              <Button
                disabled={isLoadingFollowStatus}
                onClick={onFollowToggle}
                variant={isFollowing ? "secondary" : "primary"}
              >
                {isLoadingFollowStatus ? (
                  <Loader />
                ) : isFollowing ? (
                  <>
                    <UserMinus />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus />
                    Follow
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold">{displayName ?? "-"}</h2>
          {profileDetails?.name && profileDetails.name !== displayName && (
            <span className="text-gray-500">@{profileDetails.name}</span>
          )}

          <div className="flex flex-col flex-wrap gap-1">
            {nip05 != null && nip05 !== "" && (
              <Button
                className="flex items-center gap-1 text-sm text-gray-500"
                onClick={() => {
                  navigator.clipboard.writeText(nip05);
                  toast.success("Nip05 copied to clipboard.");
                }}
                variant="tertiary"
              >
                <Mail />
                <span>{nip05}</span>
              </Button>
            )}
            <Button
              className="flex items-center gap-1 text-sm text-gray-500"
              onClick={() => {
                navigator.clipboard
                  .writeText(displayNpub)
                  .then(() => toast.success("Npub copied to clipboard."));
              }}
              variant="tertiary"
            >
              <Key />
              <span>{shortNpub}</span>
            </Button>
            {lud16 != null && lud16 !== "" && (
              <Button
                className="flex items-center gap-1 text-sm text-gray-500"
                onClick={() => {
                  navigator.clipboard
                    .writeText(lud16)
                    .then(() => toast.success("Lightning address copied to clipboard."));
                }}
                variant="tertiary"
              >
                <Zap />
                <span>{lud16}</span>
              </Button>
            )}
            {website != null && (
              <Button
                className="flex items-center gap-1 text-sm text-gray-500"
                href={website}
                is="a"
                rel="noopener noreferrer"
                target="_blank"
                variant="tertiary"
              >
                <Link />
                <span>{website.replace(/^https?:\/\/(www.)?/, "").replace(/\/$/, "")}</span>
              </Button>
            )}
          </div>
        </div>

        {profileDetails?.about != null && (
          <div className="whitespace-pre-wrap">{profileDetails.about}</div>
        )}
      </div>
    </div>
  );
};
