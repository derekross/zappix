// src/components/ProfileHeader.tsx
import React from "react";
import { NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LinkIcon from "@mui/icons-material/Link";
import BoltIcon from "@mui/icons-material/Bolt";
import VpnKeyIcon from "@mui/icons-material/VpnKey"; // Import Key icon
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail"; // Import At/Email icon
import toast from "react-hot-toast";

interface ProfileHeaderProps {
  profileUser: NDKUser;
  profileDetails: NDKUserProfile | null;
  isOwnProfile: boolean;
  isFollowing: boolean;
  isLoadingFollowStatus: boolean;
  onFollowToggle: () => void;
  onEditProfile: () => void;
}

// Helper component for consistent identifier display
const InfoItem: React.FC<{
  icon: React.ReactNode;
  label: string | undefined;
  copyValue: string | undefined;
  copyLabel: string;
}> = ({ icon, label, copyValue, copyLabel }) => {
  if (!label) return null;

  const handleCopy = (text: string | undefined, lbl: string) => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${lbl} copied!`))
      .catch(() => toast.error(`Failed to copy ${lbl}`));
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        flexWrap: "wrap",
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
          bgcolor: "action.selected",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          "& .MuiChip-label": {
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
        }}
      />
      <IconButton
        size="small"
        onClick={() => handleCopy(copyValue, copyLabel)}
        title={`Copy ${copyLabel}`}
      >
        <ContentCopyIcon fontSize="inherit" />
      </IconButton>
    </Box>
  );
};

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profileUser,
  profileDetails,
  isOwnProfile,
  isFollowing,
  isLoadingFollowStatus,
  onFollowToggle,
  onEditProfile,
}) => {
  const displayNpub = profileUser.npub;
  const shortNpub = `${displayNpub.substring(0, 10)}...${displayNpub.substring(
    displayNpub.length - 6
  )}`;
  const displayName = profileDetails?.displayName || profileDetails?.name;
  const bannerUrl = profileDetails?.banner?.startsWith("http")
    ? profileDetails.banner
    : undefined;
  const avatarUrl = profileDetails?.image?.startsWith("http")
    ? profileDetails.image
    : undefined;
  const nip05 = profileDetails?.nip05;
  const lud16 = profileDetails?.lud16;
  const website = profileDetails?.website?.startsWith("http")
    ? profileDetails.website
    : undefined;

  // FIX: Removed unused variable
  // const isNip05Verified = false; // Placeholder

  return (
    <Box sx={{ mb: 3 }}>
      {/* Banner Image */}
      <Box
        sx={{
          height: 150,
          bgcolor: "action.hover",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundImage: bannerUrl ? `url(${bannerUrl})` : "none",
          borderRadius: 1,
          mb: -8, // Overlap avatar/details onto banner
        }}
      />

      {/* Main Profile Info Area */}
      <Box
        sx={{
          p: { xs: 2, sm: 3 },
          position: "relative",
          bgcolor: "transparent",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          {/* Avatar */}
          <Avatar
            src={avatarUrl}
            alt={displayName || "Avatar"}
            sx={{
              width: 100,
              height: 100,
              mt: -6,
              border: "4px solid",
              borderColor: "background.paper",
            }}
          >
            {!avatarUrl && (displayName?.charAt(0)?.toUpperCase() || "N")}
          </Avatar>

          {/* Action Button */}
          <Box sx={{ mb: 1 }}>
            {isOwnProfile ? (
              <Button variant="contained" onClick={onEditProfile}>
                Edit Profile
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={onFollowToggle}
                disabled={isLoadingFollowStatus}
                color={isFollowing ? "secondary" : "primary"}
              >
                {isLoadingFollowStatus ? (
                  <CircularProgress size={20} color="inherit" />
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
          <Typography variant="h5" fontWeight="bold">
            {displayName || "-"}
          </Typography>
          {/* Display @name only if it's different from displayName */}
          {profileDetails?.name && profileDetails.name !== displayName && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
              @{profileDetails.name}
            </Typography>
          )}

          {/* Use InfoItem helper for consistency */}
          <InfoItem
            icon={<AlternateEmailIcon />}
            label={nip05}
            copyValue={nip05}
            copyLabel="Nostr Address (NIP-05)"
          />
          <InfoItem
            icon={<VpnKeyIcon />}
            label={shortNpub}
            copyValue={displayNpub} // Copy full npub
            copyLabel="NPub"
          />
          <InfoItem
            icon={<BoltIcon />}
            label={lud16}
            copyValue={lud16}
            copyLabel="Lightning Address (LUD-16)"
          />
        </Box>

        {/* About Section */}
        {profileDetails?.about && (
          <Typography variant="body1" sx={{ mt: 2, whiteSpace: "pre-wrap" }}>
            {profileDetails.about}
          </Typography>
        )}

        {/* Website */}
        {website && (
          <Box sx={{ mt: 2 }}>
            <Chip
              icon={<LinkIcon fontSize="small" />}
              label={website
                .replace(/^https?:\/\/(www.)?/, "")
                .replace(/\/$/, "")}
              component="a"
              href={website}
              target="_blank"
              rel="noopener noreferrer" // Added for security
              clickable
              size="small"
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
