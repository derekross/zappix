// src/components/ImagePost.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  NDKEvent,
  NDKFilter,
  NDKKind,
  NDKSubscriptionCacheUsage,
  NDKUser,
  NDKUserProfile,
} from "@nostr-dev-kit/ndk";
import { decode } from "light-bolt11-decoder";
import { nip19 } from "nostr-tools";
import { Link as RouterLink } from "react-router-dom";
import {
  Button,
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
  Skeleton, // Import Skeleton
  TextField,
  Collapse, // Import Collapse for animation
} from "@mui/material";
import { useNdk } from "../contexts/NdkContext";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import RepeatIcon from "@mui/icons-material/Repeat";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import BoltIcon from "@mui/icons-material/Bolt";
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
import { MarkdownContent } from "./MarkdownContent";

// Interface must be defined BEFORE the component uses it
interface ImagePostProps {
  event: NDKEvent;
}

const CONTACT_LIST_KIND: NDKKind = 3;
const MUTE_LIST_KIND: NDKKind = 10000;
// const REPORT_KIND: NDKKind = 1984;
const LIKE_KIND: NDKKind = 7;
const REPOST_KIND: NDKKind = 6;
const TEXT_NOTE_KIND: NDKKind = 1;
const ZAP_KIND: NDKKind = 9735;

const parseImetaTag = (tags: string[][]): Record<string, string | string[]> => {
  const metaData: Record<string, string | string[]> = {};
  const imageUrls: string[] = [];

  tags.forEach((tag) => {
    if (tag[0] === "imeta") {
      tag.slice(1).forEach((part) => {
        const spaceIndex = part.indexOf(" ");
        if (spaceIndex > 0) {
          const key = part.substring(0, spaceIndex);
          const value = part.substring(spaceIndex + 1);
          if (key === "url") {
            imageUrls.push(value);
          } else {
            // Store other imeta data if needed, handling potential duplicates or structuring appropriately
            if (metaData[key]) {
              if (Array.isArray(metaData[key])) {
                (metaData[key] as string[]).push(value);
              } else {
                metaData[key] = [metaData[key] as string, value];
              }
            } else {
              metaData[key] = value;
            }
          }
        }
      });
    } else if (tag[0] === "url" && tag[1]) {
      // Handle top-level 'url' tags as well
      imageUrls.push(tag[1]);
    }
  });

  metaData.url = imageUrls.filter((url) => url && url.startsWith("http")); // Filter for valid http urls

  return metaData;
};
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

// --- Single, Correct Component Definition ---
export const ImagePost: React.FC<ImagePostProps> = ({ event }) => {
  console.log("Rendering ImagePost for event:", event.id); // Keep log concise

  const { ndk, user: loggedInUser, signer } = useNdk();
  // const navigate = useNavigate();
  const [authorUser, setAuthorUser] = useState<NDKUser | null>(null);
  const [authorProfile, setAuthorProfile] = useState<NDKUserProfile | null>(
    null
  );
  const [isLoadingAuthor, setIsLoadingAuthor] = useState<boolean>(true); // Initialize true
  const [isBlurred, setIsBlurred] = useState<boolean>(false);
  const [warningReason, setWarningReason] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState<boolean | null>(
    null
  );
  const [isMutingAuthor, setIsMutingAuthor] = useState<boolean | null>(null);
  const [isProcessingFollow, setIsProcessingFollow] = useState(false);
  const [isProcessingMute, setIsProcessingMute] = useState(false);
  const [neventId, setNeventId] = useState<string>("");
  const [likeCount, setLikeCount] = useState<number>(0);
  const [boostCount, setBoostCount] = useState<number>(0);
  const [replyCount, setReplyCount] = useState<number>(0);
  const [zapTotalSats, setZapTotalSats] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [hasBoosted, setHasBoosted] = useState<boolean>(false);
  const [isLoadingReactions, setIsLoadingReactions] = useState<boolean>(true);
  const [isProcessingLike, setIsProcessingLike] = useState<boolean>(false);
  const [isProcessingBoost, setIsProcessingBoost] = useState<boolean>(false);
  const [isProcessingZap, setIsProcessingZap] = useState<boolean>(false);

  // State for comments
  const [showComments, setShowComments] = useState<boolean>(false);
  const [comments, setComments] = useState<NDKEvent[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>("");

  const metadata = useMemo(() => parseImetaTag(event.tags), [event.tags]);
  const imageUrls = useMemo(
    () => (Array.isArray(metadata.url) ? metadata.url : []),
    [metadata.url]
  );
  const altTextTag = event.tags.find((tag) => tag[0] === "alt");
  const altText = altTextTag?.[1] || event.content || "Nostr image post";

  // --- Effects ---
  useEffect(() => {
    const { isSensitive, reason } = checkSensitiveContent(event.tags);
    setIsBlurred(isSensitive);
    setWarningReason(reason);
  }, [event.tags]);

  // Fetch author profile effect
  useEffect(() => {
    let isMounted = true; // Track mount status for this effect
    if (ndk && event.pubkey) {
      console.log(
        `ImagePost (${event.id}): Fetching profile for ${event.pubkey}`
      );
      setIsLoadingAuthor(true);
      setAuthorUser(null); // Reset crucial states if event.pubkey changes
      setAuthorProfile(null);
      const userInstance = ndk.getUser({ pubkey: event.pubkey });
      setAuthorUser(userInstance); // Set user object immediately

      userInstance
        .fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
        .then((profile) => {
          if (isMounted) {
            // Only update state if component is still mounted
            console.log(
              `ImagePost (${event.id}): Profile fetched for ${event.pubkey}`,
              profile
            );
            setAuthorProfile(profile);
          }
        })
        .catch((err) => {
          if (isMounted)
            console.error(
              `ImagePost (${event.id}): Failed profile fetch ${event.pubkey}:`,
              err
            );
        })
        .finally(() => {
          if (isMounted) {
            console.log(
              `ImagePost (${event.id}): Finished profile fetch attempt for ${event.pubkey}`
            );
            setIsLoadingAuthor(false);
          }
        });
    } else {
      setIsLoadingAuthor(false); // Not loading if no NDK or pubkey
    }
    return () => {
      isMounted = false;
    };
  }, [ndk, event.pubkey]); // Re-run ONLY if ndk instance or event\'s pubkey changes

  // Generate nevent ID effect
  useEffect(() => {
    try {
      const encoded = nip19.neventEncode({
        id: event.id,
        relays: event.relay ? [event.relay.url] : undefined,
        author: event.pubkey,
      });
      setNeventId(encoded);
    } catch (e) {
      console.error("Error encoding nevent:", e);
      setNeventId("");
    }
  }, [event.id, event.relay, event.pubkey]);

  // Fetch follow/mute status effect
  useEffect(() => {
    if (!ndk || !loggedInUser || loggedInUser.pubkey === event.pubkey) {
      setIsFollowingAuthor(false);
      setIsMutingAuthor(false);
      return;
    }
    setIsFollowingAuthor(null);
    setIsMutingAuthor(null);
    const authorPubkey = event.pubkey;
    let isMounted = true;
    const checkStatus = async () => {
      try {
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
        console.error("Failed fetch initial follow/mute:", err);
        if (isMounted) {
          setIsFollowingAuthor(false);
          setIsMutingAuthor(false);
        }
      }
    };
    checkStatus();
    return () => {
      isMounted = false;
    };
  }, [ndk, loggedInUser, event.pubkey]);

  // Fetch reactions effect
  useEffect(() => {
    if (!ndk || !event || !event.id) return;
    setIsLoadingReactions(true);
    setHasLiked(false);
    setHasBoosted(false); // Reset on event change
    let isSubscribed = true;
    const eventId = event.id;
    const userPubkey = loggedInUser?.pubkey;
    const fetchReactions = async () => {
      try {
        const likeFilter: NDKFilter = { "#e": [eventId], kinds: [LIKE_KIND] };
        const boostFilter: NDKFilter = {
          "#e": [eventId],
          kinds: [REPOST_KIND],
        };
        const replyFilter: NDKFilter = {
          "#e": [eventId],
          kinds: [TEXT_NOTE_KIND],
        };
        const zapFilter: NDKFilter = { "#e": [eventId], kinds: [ZAP_KIND] };
        const [likeEvents, boostEvents, replyEvents] = await Promise.all([
          ndk
            .fetchEvents(likeFilter, {
              cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            })
            .catch(() => new Set<NDKEvent>()),
          ndk
            .fetchEvents(boostFilter, {
              cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            })
            .catch(() => new Set<NDKEvent>()),
          ndk
            .fetchEvents(replyFilter, {
              cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            })
            .catch(() => new Set<NDKEvent>()),
        ]);
        if (!isSubscribed) return;
        setLikeCount(likeEvents.size);
        setBoostCount(boostEvents.size);
        setReplyCount(replyEvents.size);
        if (userPubkey) {
          const [userLikeEvent, userBoostEvent] = await Promise.all([
            ndk
              .fetchEvent(
                { ...likeFilter, authors: [userPubkey], limit: 1 },
                { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST }
              )
              .catch(() => null),
            ndk
              .fetchEvent(
                { ...boostFilter, authors: [userPubkey], limit: 1 },
                { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST }
              )
              .catch(() => null),
          ]);
          if (!isSubscribed) return;
          setHasLiked(!!userLikeEvent);
          setHasBoosted(!!userBoostEvent);
        }
        const zapEvents = await ndk.fetchEvents(zapFilter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        if (!isSubscribed) return;
        let totalSats = 0;
        zapEvents.forEach((zapReceiptEvent) => {
          try {
            const descriptionTag = zapReceiptEvent.tags.find(
              (t) => t[0] === "description"
            );
            if (descriptionTag && descriptionTag[1]) {
              const zapRequestString = descriptionTag[1];
              const zapRequestData = JSON.parse(zapRequestString);
              const zapRequestTags = zapRequestData.tags || [];
              const bolt11Tag = zapRequestTags.find(
                (t: string[]) => t[0] === "bolt11"
              );
              if (bolt11Tag && bolt11Tag[1]) {
                const bolt11Invoice = bolt11Tag[1];
                const decodedInvoice = decode(bolt11Invoice);
                const amountSection = decodedInvoice.sections?.find(
                  (s) => s.name === "amount"
                );
                if (
                  amountSection?.value &&
                  typeof amountSection.value === "number"
                ) {
                  totalSats += amountSection.value / 1000;
                } else if (
                  amountSection?.value &&
                  typeof amountSection.value === "string"
                ) {
                  try {
                    totalSats += parseInt(amountSection.value, 10) / 1000;
                  } catch (e) {}
                }
              }
            }
          } catch (e) {
            console.error(
              `Error processing zap event: ${zapReceiptEvent.id}`,
              e
            );
          }
        });
        if (isSubscribed) setZapTotalSats(totalSats);
      } catch (err) {
        console.error("Error fetching reactions:", err);
      } finally {
        if (isSubscribed) setIsLoadingReactions(false);
      }
    };
    fetchReactions();
    return () => {
      isSubscribed = false;
    };
  }, [ndk, event.id, event.pubkey, loggedInUser?.pubkey]); // Re-fetch reactions if event or user changes

  // Fetch comments effect and function
  const fetchComments = useCallback(async () => {
    if (!ndk || !event?.id) return;
    setIsLoadingComments(true);
    try {
      const commentsFilter: NDKFilter = {
        kinds: [1111],
        "#e": [event.id],
      };
      const fetchedComments = await ndk.fetchEvents(commentsFilter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      });
      const commentsArray = Array.from(fetchedComments);
      setComments(commentsArray);

      // Fetch author profiles for comments
      const authorPubkeys = commentsArray.map((comment) => comment.pubkey);
      if (authorPubkeys.length > 0) {
        const profileFilter: NDKFilter = {
          kinds: [0],
          authors: authorPubkeys,
        };
        await ndk.fetchEvents(profileFilter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        // Profiles will be available in NDK cache, and components rendering comments can access them
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
      setComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  }, [ndk, event?.id]);

  // Effect to fetch comments when showComments becomes true
  useEffect(() => {
    if (showComments && comments.length === 0 && !isLoadingComments) {
      fetchComments();
    }
  }, [showComments, comments.length, isLoadingComments, fetchComments]);

  // Submit comment function
  const submitComment = useCallback(async () => {
    if (
      !ndk ||
      !signer ||
      !loggedInUser ||
      !newCommentText.trim() ||
      !event?.id ||
      !event?.pubkey
    )
      return;

    const toastId = "comment-toast";
    toast.loading("Posting comment...", { id: toastId });

    try {
      const commentEvent = new NDKEvent(ndk);
      commentEvent.kind = 1111; // NIP-22 Comment Kind
      commentEvent.content = newCommentText.trim();

      // Add tags according to NIP-22
      const tags = [
        // Root scope: Image Post Event
        ["E", event.id, event.relay?.url || "", event.pubkey],
        ["K", event.kind.toString()],
        ["P", event.pubkey, event.relay?.url || ""],

        // Parent item: For a top-level comment, parent is the same as root
        ["e", event.id, event.relay?.url || "", event.pubkey],
        ["k", event.kind.toString()],
        ["p", event.pubkey, event.relay?.url || ""],

        // Tag the author of the image post (optional based on content, but good practice)
        ["p", event.pubkey],
      ];

      // Add any mentioned users as p tags
      // This part would require more sophisticated parsing of the newCommentText
      // For now, we'll just add the basic required tags.

      commentEvent.tags = tags;

      await commentEvent.sign(signer);
      const published = await commentEvent.publish();

      if (published.size > 0) {
        toast.success("Comment posted!", { id: toastId });
        setNewCommentText("");
        // Optionally refetch comments or add the new comment to the list
        fetchComments(); // Refetch comments to include the new one
      } else {
        toast.error("Failed to publish comment.", { id: toastId });
      }
    } catch (error) {
      console.error("Comment post error:", error);
      toast.error(
        `Comment failed: ${error instanceof Error ? error.message : "Unknown"}`,
        { id: toastId }
      );
    }
  }, [ndk, signer, loggedInUser, newCommentText, event, fetchComments]);

  // --- Action Handlers ---
  const handleLike = useCallback(async () => {
    if (!ndk || !signer || !loggedInUser || isProcessingLike) return;
    setIsProcessingLike(true);
    const toastId = "like-toast";
    toast.loading(hasLiked ? "Unliking..." : "Liking...", { id: toastId });
    try {
      if (hasLiked) {
        toast.error("Unlike not implemented yet.", { id: toastId });
        setIsProcessingLike(false);
        return;
      } else {
        const likeEvent = new NDKEvent(ndk);
        likeEvent.kind = LIKE_KIND;
        likeEvent.content = "+";
        likeEvent.tags = [
          ["e", event.id, "", "root"],
          ["p", event.pubkey],
        ];
        await likeEvent.sign(signer);
        const published = await likeEvent.publish();
        if (published.size > 0) {
          toast.success("Liked!", { id: toastId });
          setHasLiked(true);
          setLikeCount((c) => c + 1);
        } else {
          toast.error("Failed to publish like.", { id: toastId });
        }
      }
    } catch (error) {
      console.error("Like error:", error);
      toast.error(
        `Like failed: ${error instanceof Error ? error.message : "Unknown"}`,
        { id: toastId }
      );
    } finally {
      setIsProcessingLike(false);
    }
  }, [
    ndk,
    signer,
    loggedInUser,
    event.id,
    event.pubkey,
    hasLiked,
    isProcessingLike,
  ]);
  const handleBoost = useCallback(async () => {
    if (!ndk || !signer || !loggedInUser || isProcessingBoost) return;
    setIsProcessingBoost(true);
    const toastId = "boost-toast";
    toast.loading(hasBoosted ? "Unboosting..." : "Boosting...", {
      id: toastId,
    });
    try {
      if (hasBoosted) {
        toast.error("Unboost not implemented yet.", { id: toastId });
        setIsProcessingBoost(false);
        return;
      } else {
        const boostEvent = new NDKEvent(ndk);
        boostEvent.kind = REPOST_KIND;
        boostEvent.content = "";
        boostEvent.tags = [
          ["e", event.id, "", ""],
          ["p", event.pubkey],
        ];
        await boostEvent.sign(signer);
        const published = await boostEvent.publish();
        if (published.size > 0) {
          toast.success("Boosted!", { id: toastId });
          setHasBoosted(true);
          setBoostCount((c) => c + 1);
        } else {
          toast.error("Failed to publish boost.", { id: toastId });
        }
      }
    } catch (error) {
      console.error("Boost error:", error);
      toast.error(
        `Boost failed: ${error instanceof Error ? error.message : "Unknown"}`,
        { id: toastId }
      );
    } finally {
      setIsProcessingBoost(false);
    }
  }, [
    ndk,
    signer,
    loggedInUser,
    event.id,
    event.pubkey,
    hasBoosted,
    isProcessingBoost,
  ]);
  const handleZap = useCallback(() => {
    if (!loggedInUser) {
      toast.error("Please log in to Zap.");
      return;
    }
    if (!authorProfile?.lud16) {
      toast.error("Author does not have a Lightning Address set up.");
      return;
    }
    toast("Zap function not fully implemented!", { icon: "⚡" });
    setIsProcessingZap(false);
  }, [loggedInUser, authorProfile]); // Simplified deps for placeholder

  // Modified handleReply to toggle comments section
  const handleReply = useCallback(() => {
    setShowComments((prev) => !prev);
  }, [setShowComments]);

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
    const shareText = altText;
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
  // --- handleFollowToggle, handleMuteToggle, handleReportClick, handleReportSubmit (Unchanged) ---
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
    const currentlyFollowing = isFollowingAuthor;
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
      const currentContactListEvent = await ndk.fetchEvent(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      });
      let currentTags: string[][] = currentContactListEvent
        ? currentContactListEvent.tags
        : [];
      let newTags: string[][] = [];
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
        newTags.length === currentTags.length &&
        currentlyFollowing === false
      ) {
        toast.success("Already following.", { id: actionToastId });
        setIsProcessingFollow(false);
        setIsFollowingAuthor(true);
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
        setIsFollowingAuthor(!currentlyFollowing);
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
    const currentlyMuted = isMutingAuthor;
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
      const currentMuteListEvent = await ndk.fetchEvent(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      });
      let currentTags: string[][] = currentMuteListEvent
        ? currentMuteListEvent.tags
        : [];
      let newTags: string[][] = [];
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
          newTags = currentTags;
        }
      }
      if (newTags.length === currentTags.length && currentlyMuted === false) {
        toast.success("Already muted.", { id: actionToastId });
        setIsProcessingMute(false);
        setIsMutingAuthor(true);
        return;
      }
      const newEvent = new NDKEvent(ndk);
      newEvent.kind = MUTE_LIST_KIND;
      newEvent.created_at = Math.floor(Date.now() / 1000);
      newEvent.tags = newTags;
      newEvent.content = "";
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
      reportEvent.kind = 1984;
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
  };

  // --- Rendering ---
  // Condition 1: Basic data check (check if imageUrls has any valid http urls)
  const validImageUrls = imageUrls.filter((url) => url?.startsWith("http"));
  if (validImageUrls.length === 0) {
    console.warn(`Skipping render: No valid imageUrls for event ${event.id}`);
    return null;
  }

  // Condition 2: Show Skeleton while author profile is loading
  if (isLoadingAuthor) {
    console.log(
      `Rendering Skeleton for event ${event.id} because isLoadingAuthor is true`
    );
    return (
      <Card elevation={2} sx={{ mb: { xs: 2, sm: 3 } }}>
        <CardHeader
          avatar={
            <Skeleton
              animation="wave"
              variant="circular"
              width={40}
              height={40}
            />
          }
          title={
            <Skeleton
              animation="wave"
              height={10}
              width="40%"
              style={{ marginBottom: 6 }}
            />
          }
          subheader={<Skeleton animation="wave" height={10} width="20%" />}
        />
        <Skeleton sx={{ height: 300 }} animation="wave" variant="rectangular" />
        <CardContent>
          <Skeleton animation="wave" height={10} style={{ marginBottom: 6 }} />
          <Skeleton animation="wave" height={10} width="80%" />
        </CardContent>
      </Card>
    );
  }

  // Condition 3: If loading finished, but authorUser still wasn\'t set
  if (!authorUser) {
    console.warn(
      `Skipping render: authorUser is null after loading attempt for event ${event.id}`
    );
    return null; // Or render an error placeholder
  }

  // --- Proceed with rendering now that authorUser is available ---
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
    <Card
      elevation={2}
      sx={{
        mb: { xs: 2, sm: 3 },
        // Removed maxWidth, mx, overflow - Let container handle sizing
      }}
    >
      <CardHeader
        avatar={
          <Avatar
            component={RouterLink}
            to={`/profile/${authorUser.npub}`}
            src={authorAvatarUrl}
            aria-label="author avatar"
          >
            {" "}
            {!authorAvatarUrl && authorDisplayName.charAt(0).toUpperCase()}{" "}
          </Avatar>
        }
        action={
          (loggedInUser || neventId) && (
            <>
              {" "}
              <IconButton
                aria-label="settings"
                onClick={handleMenuOpen}
                id={`post-actions-button-${event.id}`}
                aria-controls={
                  isMenuOpen ? `post-action-menu-${event.id}` : undefined
                }
                aria-haspopup="true"
                aria-expanded={isMenuOpen ? "true" : undefined}
              >
                {" "}
                <MoreVertIcon />{" "}
              </IconButton>{" "}
              <Menu
                id={`post-action-menu-${event.id}`}
                anchorEl={anchorEl}
                open={isMenuOpen}
                onClose={handleMenuClose}
                MenuListProps={{
                  "aria-labelledby": `post-actions-button-${event.id}`,
                }}
              >
                {" "}
                {neventId && (
                  <MenuItem onClick={handleCopyNevent}>
                    {" "}
                    <ListItemIcon>
                      <ContentCopyIcon fontSize="small" />
                    </ListItemIcon>{" "}
                    <ListItemText>Copy Note ID</ListItemText>{" "}
                  </MenuItem>
                )}{" "}
                {neventId && (
                  <MenuItem onClick={handleShare}>
                    {" "}
                    <ListItemIcon>
                      <ShareIcon fontSize="small" />
                    </ListItemIcon>{" "}
                    <ListItemText>Share</ListItemText>{" "}
                  </MenuItem>
                )}{" "}
                {loggedInUser && !isOwnPost && (
                  <MenuItem
                    onClick={handleFollowToggle}
                    disabled={isFollowingAuthor === null || isProcessingFollow}
                  >
                    {" "}
                    <ListItemIcon>
                      {" "}
                      {isProcessingFollow ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : isFollowingAuthor ? (
                        <PersonRemoveIcon fontSize="small" />
                      ) : (
                        <PersonAddIcon fontSize="small" />
                      )}{" "}
                    </ListItemIcon>{" "}
                    <ListItemText>
                      {isFollowingAuthor ? "Unfollow Author" : "Follow Author"}
                    </ListItemText>{" "}
                  </MenuItem>
                )}{" "}
                {loggedInUser && !isOwnPost && (
                  <MenuItem
                    onClick={handleMuteToggle}
                    disabled={isMutingAuthor === null || isProcessingMute}
                  >
                    {" "}
                    <ListItemIcon>
                      {" "}
                      {isProcessingMute ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : isMutingAuthor ? (
                        <VolumeUpIcon fontSize="small" />
                      ) : (
                        <VolumeOffIcon fontSize="small" />
                      )}{" "}
                    </ListItemIcon>{" "}
                    <ListItemText>
                      {isMutingAuthor ? "Unmute Author" : "Mute Author"}
                    </ListItemText>{" "}
                  </MenuItem>
                )}{" "}
                {loggedInUser && !isOwnPost && (
                  <MenuItem
                    onClick={handleReportClick}
                    disabled={isSubmittingReport}
                  >
                    {" "}
                    <ListItemIcon>
                      {" "}
                      <FlagIcon fontSize="small" />{" "}
                    </ListItemIcon>{" "}
                    <ListItemText>Report Post</ListItemText>{" "}
                  </MenuItem>
                )}{" "}
              </Menu>{" "}
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
            {" "}
            {authorDisplayName}{" "}
          </Link>
        }
        subheader={new Date(event.created_at! * 1000).toLocaleString()}
      />
      <Box
        sx={{
          position: "relative",
          cursor: isBlurred ? "pointer" : "default",
          width: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 2, // spacing between multiple images
          mt: 2,
        }}
        onClick={handleImageClick}
      >
        {validImageUrls.map((url, index) => (
          <CardMedia
            key={index}
            component="img"
            image={url}
            alt={altText}
            sx={{
              width: "100%",
              maxHeight: "80vh",
              objectFit: "contain",
              display: "block",
              borderRadius: 1,
              filter: isBlurred ? "blur(25px)" : "none",
              transition: "filter 0.3s ease-in-out",
            }}
          />
        ))}

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
              zIndex: 1,
            }}
          >
            <VisibilityOffIcon sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="body1" gutterBottom>
              {warningReason || "Content Warning"}
            </Typography>
            <Typography variant="caption">View content</Typography>
          </Box>
        )}
      </Box>

      {event.content && (
        <CardContent sx={{ pt: 1, pb: "8px !important" }}>
          <Typography variant="body2" color="text.secondary">
            <MarkdownContent content={event.content || ""} />
          </Typography>
        </CardContent>
      )}

      <CardActions
        disableSpacing
        sx={{ pt: 0, justifyContent: "space-around" }}
      >
        <Button
          size="small"
          startIcon={
            isProcessingLike ? (
              <CircularProgress size={16} />
            ) : hasLiked ? (
              <FavoriteIcon color="error" />
            ) : (
              <FavoriteBorderIcon />
            )
          }
          onClick={handleLike}
          disabled={!loggedInUser || isProcessingLike}
          sx={{ minWidth: 60 }}
        >
          {" "}
          {isLoadingReactions ? (
            <CircularProgress size={12} />
          ) : likeCount > 0 ? (
            likeCount
          ) : (
            ""
          )}{" "}
        </Button>
        <Button
          size="small"
          startIcon={
            isProcessingBoost ? (
              <CircularProgress size={16} />
            ) : (
              <RepeatIcon color={hasBoosted ? "primary" : "inherit"} />
            )
          }
          onClick={handleBoost}
          disabled={!loggedInUser || isProcessingBoost}
          sx={{ minWidth: 61 }}
        >
          {" "}
          {isLoadingReactions ? (
            <CircularProgress size={12} />
          ) : boostCount > 0 ? (
            boostCount
          ) : (
            ""
          )}{" "}
        </Button>
        <Button
          size="small"
          startIcon={<ChatBubbleOutlineIcon />}
          onClick={handleReply}
          sx={{ minWidth: 62 }}
        >
          {" "}
          {isLoadingReactions ? (
            <CircularProgress size={12} />
          ) : replyCount > 0 ? (
            replyCount
          ) : (
            ""
          )}{" "}
        </Button>
        <Button
          size="small"
          startIcon={
            isProcessingZap ? (
              <CircularProgress size={16} />
            ) : (
              <BoltIcon sx={{ color: "#FFC107" }} />
            )
          }
          onClick={handleZap}
          disabled={!loggedInUser || isProcessingZap || !authorProfile?.lud16}
          sx={{ minWidth: 63 }}
          title={
            !authorProfile?.lud16
              ? "Author has no Lightning Address"
              : undefined
          }
        >
          {" "}
          {isLoadingReactions ? (
            <CircularProgress size={12} />
          ) : zapTotalSats > 0 ? (
            formatSats(zapTotalSats)
          ) : (
            ""
          )}{" "}
        </Button>
      </CardActions>

      {/* Comments Section */}
      <Collapse in={showComments} timeout="auto" unmountOnExit>
        <CardContent sx={{ pt: 0, pb: "8px !important" }}>
          <Typography variant="h6" gutterBottom>
            Comments
          </Typography>
          {isLoadingComments ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : comments.length > 0 ? (
            <Box>
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  commentEvent={comment}
                  ndk={ndk}
                />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No comments yet.
            </Typography>
          )}
          {loggedInUser && (
            <Box sx={{ mt: 2, display: "flex", alignItems: "center" }}>
              <TextField
                label="Add a comment"
                variant="outlined"
                size="small"
                fullWidth
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                sx={{ mr: 1 }}
              />
              <Button
                variant="contained"
                onClick={submitComment}
                disabled={!newCommentText.trim()}
              >
                Post
              </Button>
            </Box>
          )}
        </CardContent>
      </Collapse>

      {loggedInUser && (
        <ReportPostDialog
          open={isReportDialogOpen}
          onClose={handleCloseReportDialog}
          onSubmit={handleReportSubmit}
          event={event}
        />
      )}
    </Card>
  );
};

interface CommentItemProps {
  commentEvent: NDKEvent;
  ndk: any; // Use 'any' or a more specific NDK type if available and imported
}

const CommentItem: React.FC<CommentItemProps> = ({ commentEvent, ndk }) => {
  const [authorProfile, setAuthorProfile] = useState<NDKUserProfile | null>(
    null
  );
  const authorUser = useMemo(
    () => ndk.getUser({ pubkey: commentEvent.pubkey }),
    [ndk, commentEvent.pubkey]
  );

  useEffect(() => {
    let isMounted = true;
    if (authorUser) {
      authorUser
        .fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
        .then((profile: NDKUserProfile | null) => {
          if (isMounted) {
            setAuthorProfile(profile);
          }
        })
        .catch((err: unknown) =>
          console.error("Failed to fetch comment author profile:", err)
        );
    }
    return () => {
      isMounted = false;
    };
  }, [authorUser]);

  const authorDisplayName =
    authorProfile?.displayName ||
    authorProfile?.name ||
    authorUser.npub.substring(0, 8) + "...";
  const authorAvatarUrl = authorProfile?.image?.startsWith("http")
    ? authorProfile.image
    : undefined;

  return (
    <Box
      sx={{
        mb: 1,
        pb: 1,
        borderBottom: "1px solid #eee",
        display: "flex",
        alignItems: "flex-start",
      }}
    >
      <Avatar src={authorAvatarUrl} sx={{ width: 24, height: 24, mr: 1 }}>
        {!authorAvatarUrl && authorDisplayName.charAt(0).toUpperCase()}
      </Avatar>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="body2">
          <strong>{authorDisplayName}:</strong> {commentEvent.content}
        </Typography>
      </Box>
    </Box>
  );
};

// Ensure this helper function exists or is imported
const formatSats = (amount: number): string => {
  if (isNaN(amount) || amount <= 0) return "";
  if (amount < 1000) return amount.toString();
  if (amount < 1000000)
    return (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1) + "k";
  return (amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1) + "M";
};
