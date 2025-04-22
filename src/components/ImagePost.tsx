// src/components/ImagePost.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  NDKEvent,
  NDKFilter,
  NDKKind,
  NDKSubscriptionCacheUsage,
  NDKUser,
} from "@nostr-dev-kit/ndk"; // Added NDKUser
import { nip19 } from "nostr-tools";
import { Link as RouterLink } from "react-router-dom";
// FIX 1: Removed unused Chip import
import {
  Card,
  CardHeader,
  CardMedia,
  CardContent,
  CardActions,
  Avatar,
  Typography,
  Box,
  IconButton,
  Link,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from "@mui/material";
import { useNdk } from "../contexts/NdkContext";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import RepeatIcon from "@mui/icons-material/Repeat";
import ReplyIcon from "@mui/icons-material/Reply";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ShareIcon from "@mui/icons-material/Share";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import FlagIcon from "@mui/icons-material/Flag";
import { ReportPostDialog } from "./ReportPostDialog";
import toast from "react-hot-toast";

interface ImagePostProps {
  event: NDKEvent;
}

const CONTACT_LIST_KIND: NDKKind = 3;
const MUTE_LIST_KIND: NDKKind = 10000;
const REPORT_KIND: NDKKind = 1984; // NIP-56 Report Kind

// Helper to parse imeta tag
const parseImetaTag = (tags: string[][]): Record<string, string> => {
  const imeta = tags.find((tag) => tag[0] === "imeta");
  if (!imeta) return {};
  const metaData: Record<string, string> = {};
  imeta.slice(1).forEach((part) => {
    const spaceIndex = part.indexOf(" ");
    if (spaceIndex > 0) {
      const key = part.substring(0, spaceIndex);
      const value = part.substring(spaceIndex + 1);
      metaData[key] = value;
    }
  });
  return metaData;
};

// Helper to check for sensitive content tags
const checkSensitiveContent = (
  tags: string[][]
): { isSensitive: boolean; reason: string | null } => {
  let isSensitive = false;
  let reason: string | null = null;
  for (const tag of tags) {
    if (tag[0] === "content-warning") {
      isSensitive = true;
      reason = tag[1] || "Sensitive Content";
      break;
    }
    if (tag[0] === "t" && tag[1]?.toLowerCase() === "nsfw") {
      isSensitive = true;
      reason = reason || "NSFW";
    }
  }
  return { isSensitive, reason };
};

export const ImagePost: React.FC<ImagePostProps> = ({ event }) => {
  const { ndk, user: loggedInUser, signer } = useNdk();
  // Author details state
  const [authorUser, setAuthorUser] = useState<NDKUser | null>(null);
  const [authorProfile, setAuthorProfile] = useState<any>(null); // Keep simple 'any' or define NDKUserProfile type
  // Content state
  const [isBlurred, setIsBlurred] = useState<boolean>(false);
  const [warningReason, setWarningReason] = useState<string | null>(null);
  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  // Report dialog state
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  // Follow/Mute state
  const [isFollowingAuthor, setIsFollowingAuthor] = useState<boolean | null>(
    null
  ); // null = loading/unknown
  const [isMutingAuthor, setIsMutingAuthor] = useState<boolean | null>(null); // null = loading/unknown
  const [isProcessingFollow, setIsProcessingFollow] = useState(false);
  const [isProcessingMute, setIsProcessingMute] = useState(false);
  // IDs
  const [neventId, setNeventId] = useState<string>("");

  const metadata = useMemo(() => parseImetaTag(event.tags), [event.tags]);
  const imageUrl = metadata.url;
  // Determine alt text: Use 'alt' tag if present, otherwise fallback to event content
  const altTextTag = event.tags.find((tag) => tag[0] === "alt");
  const altText = altTextTag?.[1] || event.content || "Nostr image post"; // Use 'alt' tag first

  // Check sensitive content
  useEffect(() => {
    const { isSensitive, reason } = checkSensitiveContent(event.tags);
    setIsBlurred(isSensitive);
    setWarningReason(reason);
  }, [event.tags]);

  // Fetch author profile
  useEffect(() => {
    if (ndk && event.pubkey) {
      const user = ndk.getUser({ pubkey: event.pubkey });
      setAuthorUser(user); // Store the NDKUser instance
      user
        .fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST }) // Use cache first for profile
        .then((profile) => {
          // Check component hasn't unmounted or user changed
          if (user.pubkey === event.pubkey) {
            setAuthorProfile(profile);
          }
        })
        .catch((err) =>
          console.error(`Failed to fetch profile for ${event.pubkey}:`, err)
        );
    }
  }, [ndk, event.pubkey]); // Re-fetch if NDK or pubkey changes

  // Generate nevent ID
  useEffect(() => {
    try {
      const encoded = nip19.neventEncode({
        id: event.id,
        // Include relays if available, but make it optional
        relays: event.relay ? [event.relay.url] : undefined,
        author: event.pubkey,
      });
      setNeventId(encoded);
    } catch (e) {
      console.error("Error encoding nevent:", e);
      setNeventId("");
    }
  }, [event.id, event.relay, event.pubkey]);

  // Check initial follow/mute status
  useEffect(() => {
    if (!ndk || !loggedInUser || loggedInUser.pubkey === event.pubkey) {
      setIsFollowingAuthor(false); // Can't follow self
      setIsMutingAuthor(false); // Can't mute self
      return;
    }
    // Reset while loading
    setIsFollowingAuthor(null);
    setIsMutingAuthor(null);
    const authorPubkey = event.pubkey;
    let isMounted = true; // Track mount status

    const checkStatus = async () => {
      try {
        // Check follow status
        const contactFilter: NDKFilter = {
          kinds: [CONTACT_LIST_KIND],
          authors: [loggedInUser.pubkey],
          limit: 1,
        };
        const contactListEvent = await ndk.fetchEvent(contactFilter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        if (isMounted) {
          const foundFollow = !!contactListEvent?.tags.some(
            (t) => t[0] === "p" && t[1] === authorPubkey
          );
          setIsFollowingAuthor(foundFollow);
        }

        // Check mute status
        const muteFilter: NDKFilter = {
          kinds: [MUTE_LIST_KIND],
          authors: [loggedInUser.pubkey],
          limit: 1,
        };
        const muteListEvent = await ndk.fetchEvent(muteFilter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        if (isMounted) {
          const foundMute = !!muteListEvent?.tags.some(
            (t) => t[0] === "p" && t[1] === authorPubkey
          );
          setIsMutingAuthor(foundMute);
        }
      } catch (err) {
        console.error("Failed to fetch initial follow/mute status:", err);
        if (isMounted) {
          // Set to false on error? Or keep null? Let's default to false.
          setIsFollowingAuthor(false);
          setIsMutingAuthor(false);
        }
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    }; // Cleanup function
  }, [ndk, loggedInUser, event.pubkey]); // Dependencies

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) =>
    setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleCopyNevent = () => {
    if (neventId) {
      navigator.clipboard
        .writeText(neventId)
        .then(() => toast.success("Note ID (nevent) copied!"))
        .catch(() => toast.error("Failed to copy Note ID."));
    } else {
      toast.error("Could not generate Note ID.");
    }
    handleMenuClose();
  };

  const handleShare = async () => {
    const shareUrl = `https://njump.me/${neventId}`;
    const shareTitle = `Nostr post by ${
      authorProfile?.displayName || event.pubkey.substring(0, 10)
    }...`;
    const shareText = altText; // Use altText (which falls back to content)

    if (navigator.share && neventId) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        toast.success("Shared successfully!");
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Error sharing:", err);
          toast.error(`Could not share: ${err.message}`);
        }
      }
    } else if (neventId) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => toast.success("Share URL (njump.me) copied!"))
        .catch(() => toast.error("Failed to copy Share URL."));
    } else {
      toast.error("Could not generate Share URL.");
    }
    handleMenuClose();
  };

  const handleFollowToggle = async () => {
    if (
      !loggedInUser ||
      !signer ||
      !ndk ||
      isProcessingFollow ||
      loggedInUser.pubkey === event.pubkey
    )
      return;
    const targetPubkey = event.pubkey;
    const currentlyFollowing = !!isFollowingAuthor; // Coerce null to false for action intent
    const actionToastId = "follow-toast";
    setIsProcessingFollow(true);
    handleMenuClose();
    toast.loading(currentlyFollowing ? "Unfollowing..." : "Following...", {
      id: actionToastId,
    });
    try {
      const filter: NDKFilter = {
        kinds: [CONTACT_LIST_KIND],
        authors: [loggedInUser.pubkey],
        limit: 1,
      };
      // FIX 2: Use CACHE_FIRST workaround
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
          newTags = currentTags; // Already following
        }
      }
      // Avoid publishing if list is identical (e.g., rapid clicks)
      if (
        JSON.stringify(currentTags.sort()) === JSON.stringify(newTags.sort())
      ) {
        toast.dismiss(actionToastId); // Dismiss loading
        setIsFollowingAuthor(!currentlyFollowing); // Ensure state matches reality
        setIsProcessingFollow(false);
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
        toast.success(currentlyFollowing ? "Unfollowed!" : "Followed!", {
          id: actionToastId,
        });
        setIsFollowingAuthor(!currentlyFollowing); // Update state on success
      } else {
        toast.error("Failed to publish contact list update.", {
          id: actionToastId,
        });
        throw new Error("Publish failed");
      }
    } catch (error) {
      toast.error(`Failed to ${currentlyFollowing ? "unfollow" : "follow"}.`, {
        id: actionToastId,
      });
      console.error("Follow/Unfollow Error:", error);
      // Don't revert state optimistically on error, let useEffect correct it later if needed
    } finally {
      setIsProcessingFollow(false);
    }
  };

  const handleMuteToggle = async () => {
    if (
      !loggedInUser ||
      !signer ||
      !ndk ||
      isProcessingMute ||
      loggedInUser.pubkey === event.pubkey
    )
      return;
    const targetPubkey = event.pubkey;
    const currentlyMuted = !!isMutingAuthor; // Coerce null to false
    const actionToastId = "mute-toast";
    setIsProcessingMute(true);
    handleMenuClose();
    toast.loading(currentlyMuted ? "Unmuting..." : "Muting...", {
      id: actionToastId,
    });
    try {
      const filter: NDKFilter = {
        kinds: [MUTE_LIST_KIND],
        authors: [loggedInUser.pubkey],
        limit: 1,
      };
      // FIX 3: Use CACHE_FIRST workaround
      const currentMuteListEvent = await ndk.fetchEvent(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      });
      let currentTags: string[][] = currentMuteListEvent?.tags || [];
      let newTags: string[][];
      if (currentlyMuted) {
        newTags = currentTags.filter(
          (tag) => !(tag[0] === "p" && tag[1] === targetPubkey)
        );
      } else {
        if (
          !currentTags.some((tag) => tag[0] === "p" && tag[1] === targetPubkey)
        ) {
          newTags = [...currentTags, ["p", targetPubkey]];
        } else {
          newTags = currentTags; // Already muted
        }
      }
      if (
        JSON.stringify(currentTags.sort()) === JSON.stringify(newTags.sort())
      ) {
        toast.dismiss(actionToastId);
        setIsMutingAuthor(!currentlyMuted);
        setIsProcessingMute(false);
        return;
      }
      const newEvent = new NDKEvent(ndk);
      newEvent.kind = MUTE_LIST_KIND;
      newEvent.created_at = Math.floor(Date.now() / 1000);
      newEvent.tags = newTags;
      newEvent.content = currentMuteListEvent?.content || ""; // Preserve content if exists
      await newEvent.sign(signer);
      const publishedRelays = await newEvent.publish();
      if (publishedRelays.size > 0) {
        toast.success(currentlyMuted ? "Unmuted!" : "Muted!", {
          id: actionToastId,
        });
        setIsMutingAuthor(!currentlyMuted);
      } else {
        toast.error("Failed to publish mute list update.", {
          id: actionToastId,
        });
        throw new Error("Publish failed");
      }
    } catch (error) {
      toast.error(`Failed to ${currentlyMuted ? "unmute" : "mute"}.`, {
        id: actionToastId,
      });
      console.error("Mute/Unmute Error:", error);
    } finally {
      setIsProcessingMute(false);
    }
  };

  const handleReportClick = () => {
    if (!loggedInUser) {
      toast.error("Please log in to report posts.");
      handleMenuClose();
      return;
    }
    setIsReportDialogOpen(true);
    handleMenuClose();
  };

  const handleReportSubmit = async (reportType: string, reasonText: string) => {
    if (!ndk || !loggedInUser || !signer) {
      toast.error("Cannot submit report: NDK, user, or signer missing.");
      handleCloseReportDialog();
      return;
    }
    setIsSubmittingReport(true);
    const reportToastId = "report-toast";
    toast.loading("Submitting report...", { id: reportToastId });
    try {
      const reportEvent = new NDKEvent(ndk);
      reportEvent.kind = REPORT_KIND;
      reportEvent.created_at = Math.floor(Date.now() / 1000);
      reportEvent.tags = [
        ["e", event.id],
        ["p", event.pubkey],
        ["report", reportType],
      ];
      reportEvent.content = reasonText || "";
      await reportEvent.sign(signer);
      const publishedRelays = await reportEvent.publish();
      if (publishedRelays.size > 0) {
        toast.success("Report submitted successfully!", { id: reportToastId });
      } else {
        toast.error("Failed to publish report to any connected write relays.", {
          id: reportToastId,
        });
      }
    } catch (error) {
      console.error("Error submitting NIP-56 report:", error);
      toast.error(
        `Failed to submit report: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { id: reportToastId }
      );
    } finally {
      setIsSubmittingReport(false);
      handleCloseReportDialog();
    }
  };

  const handleCloseReportDialog = () => {
    setIsReportDialogOpen(false);
  };

  const handleImageClick = () => {
    if (isBlurred) {
      setIsBlurred(false);
    }
    // Optionally navigate to a detail view or open modal on non-blurred click
    // else { navigate(`/post/${neventId}`); }
  };

  // Don't render if essential data is missing
  if (!imageUrl?.startsWith("http")) {
    console.warn(
      `Skipping render for event ${event.id}: Missing or invalid image URL in imeta tag.`
    );
    return null;
  }
  if (!authorUser) {
    // Wait for author user instance
    return null; // Or a placeholder skeleton
  }

  const authorDisplayName =
    authorProfile?.displayName ||
    authorProfile?.name ||
    authorUser.npub.substring(0, 10) + "...";
  const authorAvatarUrl = authorProfile?.image?.startsWith("http")
    ? authorProfile.image
    : undefined;
  const isMenuOpen = Boolean(anchorEl);
  const isOwnPost = loggedInUser?.pubkey === event.pubkey;

  return (
    <Card elevation={2} sx={{ mb: { xs: 2, sm: 3 } }}>
      {" "}
      {/* Added responsive margin */}
      <CardHeader
        avatar={
          <Avatar
            component={RouterLink}
            to={`/profile/${authorUser.npub}`} // Use authorUser
            src={authorAvatarUrl}
            aria-label="author avatar"
          >
            {!authorAvatarUrl && authorDisplayName.charAt(0).toUpperCase()}
          </Avatar>
        }
        action={
          (loggedInUser || neventId) && ( // Show menu if logged in OR if nevent is available for sharing
            <>
              <IconButton aria-label="settings" onClick={handleMenuOpen}>
                <MoreVertIcon />
              </IconButton>
              <Menu
                id={`post-action-menu-${event.id}`}
                anchorEl={anchorEl}
                open={isMenuOpen}
                onClose={handleMenuClose}
                MenuListProps={{ "aria-labelledby": "post-actions-button" }}
              >
                {neventId && (
                  <MenuItem onClick={handleCopyNevent}>
                    <ListItemIcon>
                      <ContentCopyIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Copy Note ID</ListItemText>
                  </MenuItem>
                )}
                {neventId && (
                  <MenuItem onClick={handleShare}>
                    <ListItemIcon>
                      <ShareIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Share</ListItemText>
                  </MenuItem>
                )}

                {loggedInUser && !isOwnPost && (
                  <MenuItem
                    onClick={handleFollowToggle}
                    disabled={isFollowingAuthor === null || isProcessingFollow}
                  >
                    <ListItemIcon>
                      {isProcessingFollow ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : isFollowingAuthor ? (
                        <PersonRemoveIcon fontSize="small" />
                      ) : (
                        <PersonAddIcon fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText>
                      {isFollowingAuthor ? "Unfollow Author" : "Follow Author"}
                    </ListItemText>
                  </MenuItem>
                )}
                {loggedInUser && !isOwnPost && (
                  <MenuItem
                    onClick={handleMuteToggle}
                    disabled={isMutingAuthor === null || isProcessingMute}
                  >
                    <ListItemIcon>
                      {isProcessingMute ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : isMutingAuthor ? (
                        <VolumeUpIcon fontSize="small" />
                      ) : (
                        <VolumeOffIcon fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText>
                      {isMutingAuthor ? "Unmute Author" : "Mute Author"}
                    </ListItemText>
                  </MenuItem>
                )}
                {loggedInUser &&
                  !isOwnPost && ( // Only allow reporting others' posts
                    <MenuItem
                      onClick={handleReportClick}
                      disabled={isSubmittingReport}
                    >
                      <ListItemIcon>
                        <FlagIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Report Post</ListItemText>
                    </MenuItem>
                  )}
              </Menu>
            </>
          )
        }
        title={
          <Link
            component={RouterLink}
            to={`/profile/${authorUser.npub}`}
            underline="hover"
            color="inherit"
          >
            {authorDisplayName}
          </Link>
        }
        subheader={new Date(event.created_at! * 1000).toLocaleString()}
      />
      <Box
        sx={{ position: "relative", cursor: isBlurred ? "pointer" : "default" }}
        onClick={handleImageClick}
      >
        <CardMedia
          component="img"
          image={imageUrl}
          alt={altText}
          sx={{
            display: "block",
            maxHeight: "80vh",
            objectFit: "contain",
            width: "100%",
            filter: isBlurred ? "blur(25px)" : "none",
            transition: "filter 0.3s ease-in-out",
          }}
        />
        {isBlurred && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              textAlign: "center",
              p: 2,
            }}
          >
            <VisibilityOffIcon sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="body1" gutterBottom>
              {warningReason || "Content Warning"}
            </Typography>
            <Typography variant="caption">Click to reveal</Typography>
          </Box>
        )}
      </Box>
      {/* Display altText only if it differs from event.content (which is often empty for images) or if event.content exists */}
      {((altText && altText !== event.content) || event.content) && (
        <CardContent sx={{ pt: 1, pb: "8px !important" }}>
          {" "}
          {/* Reduce padding */}
          <Typography variant="body2" color="text.secondary">
            {altText}
          </Typography>
        </CardContent>
      )}
      <CardActions disableSpacing sx={{ pt: 0 }}>
        <IconButton aria-label="like">
          <FavoriteBorderIcon />
        </IconButton>
        <IconButton aria-label="repost">
          <RepeatIcon />
        </IconButton>
        <IconButton aria-label="reply">
          <ReplyIcon />
        </IconButton>
        {/* Add Zap button placeholder later */}
      </CardActions>
      {loggedInUser && (
        <ReportPostDialog
          open={isReportDialogOpen}
          onClose={handleCloseReportDialog}
          onSubmit={handleReportSubmit}
          event={event} // Pass the full event
        />
      )}
    </Card>
  );
};
