import AlternateEmailIcon from "@mui/icons-material/AlternateEmail"; // Import At/Email icon
import BoltIcon from "@mui/icons-material/Bolt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LinkIcon from "@mui/icons-material/Link";
import VpnKeyIcon from "@mui/icons-material/VpnKey"; // Import Key icon
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";
// src/components/ProfileHeader.tsx
import React from "react";
import toast from "react-hot-toast";

interface ProfileHeaderProps {
  isFollowing: boolean;
  isLoadingFollowStatus: boolean;
  isOwnProfile: boolean;
  profileDetails: null | NDKUserProfile;
  profileUser: NDKUser;
  onEditProfile: () => void;
  onFollowToggle: () => void;
}

// Helper component for consistent identifier display
const InfoItem: React.FC<{
  copyLabel: string;
  copyValue: undefined | string;
  icon: React.ReactNode;
  label: undefined | string;
}> = ({ copyLabel, copyValue, icon, label }) => {
  if (!label) return null;

  const handleCopy = (text: undefined | string, lbl: string) => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${lbl} copied!`))
      .catch(() => toast.error(`Failed to copy ${lbl}`));
  };

  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 0.5,
        mt: 0.5,
      }}
    >
      <Chip
        icon={
          React.isValidElement(icon)
            ? React.cloneElement(icon, { fontSize: "small" } as any)
            : undefined
        }
        label={label}
        size="small"
        sx={{
          "& .MuiChip-label": {
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
          bgcolor: "action.selected",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      />
      <IconButton
        onClick={() => handleCopy(copyValue, copyLabel)}
        size="small"
        title={`Copy ${copyLabel}`}
      >
        <ContentCopyIcon fontSize="inherit" />
      </IconButton>
    </Box>
  );
};

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  isFollowing,
  isLoadingFollowStatus,
  isOwnProfile,
  onEditProfile,
  onFollowToggle,
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
    <Box sx={{ mb: 3 }}>
      {/* Banner Image */}
      <Box
        sx={{
          backgroundImage: bannerUrl ? `url(${bannerUrl})` : "none",
          backgroundPosition: "center",
          backgroundSize: "cover",
          bgcolor: "action.hover",
          borderRadius: 1,
          height: 150,
          mb: -8, // Overlap avatar/details onto banner
        }}
      />

      {/* Main Profile Info Area */}
      <Box
        sx={{
          bgcolor: "transparent",
          p: { sm: 3, xs: 2 },
          position: "relative",
        }}
      >
        <Box
          sx={{
            alignItems: "flex-end",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {/* Avatar */}
          <Avatar
            alt={displayName || "Avatar"}
            src={avatarUrl}
            sx={{
              border: "4px solid",
              borderColor: "background.paper",
              height: 100,
              mt: -6,
              width: 100,
            }}
          >
            {!avatarUrl && (displayName?.charAt(0)?.toUpperCase() || "N")}
          </Avatar>

          {/* Action Button */}
          <Box sx={{ mb: 1 }}>
            {isOwnProfile ? (
              <Button onClick={onEditProfile} variant="contained">
                Edit Profile
              </Button>
            ) : (
              <Button
                color={isFollowing ? "secondary" : "primary"}
                disabled={isLoadingFollowStatus}
                onClick={onFollowToggle}
                variant="contained"
              >
                {isLoadingFollowStatus ? (
                  <CircularProgress color="inherit" size={20} />
                ) : isFollowing ? (
                  "Unfollow"
                ) : (
                  "Follow"
                )}
              </Button>
            )}
          </Box>
        </Box>

        {/* Names & Identifiers */}
        <Box sx={{ mt: 1 }}>
          <Typography fontWeight="bold" variant="h5">
            {displayName || "-"}
          </Typography>
          {/* Display @name only if it's different from displayName */}
          {profileDetails?.name && profileDetails.name !== displayName && (
            <Typography color="text.secondary" sx={{ mb: 0.5 }} variant="body1">
              @{profileDetails.name}
            </Typography>
          )}

          {/* Use InfoItem helper for consistency */}
          <InfoItem
            copyLabel="Nostr Address (NIP-05)"
            copyValue={nip05}
            icon={<AlternateEmailIcon />}
            label={nip05}
          />
          <InfoItem
            copyLabel="NPub"
            copyValue={displayNpub} // Copy full npub
            icon={<VpnKeyIcon />}
            label={shortNpub}
          />
          <InfoItem
            copyLabel="Lightning Address (LUD-16)"
            copyValue={lud16}
            icon={<BoltIcon />}
            label={lud16}
          />
        </Box>

        {/* About Section */}
        {profileDetails?.about && (
          <Typography sx={{ mt: 2, whiteSpace: "pre-wrap" }} variant="body1">
            {profileDetails.about}
          </Typography>
        )}

        {/* Website */}
        {website && (
          <Box sx={{ mt: 2 }}>
            <Chip
              clickable
              component="a"
              href={website}
              icon={<LinkIcon fontSize="small" />}
              label={website.replace(/^https?:\/\/(www.)?/, "").replace(/\/$/, "")}
              rel="noopener noreferrer" // Added for security
              size="small"
              target="_blank"
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
