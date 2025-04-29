// src/components/ImagePost.tsx
import BoltIcon from "@mui/icons-material/Bolt";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FlagIcon from "@mui/icons-material/Flag";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import RepeatIcon from "@mui/icons-material/Repeat";
import ShareIcon from "@mui/icons-material/Share";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CardMedia,
  CircularProgress,
  Collapse, // Import Collapse for animation
  IconButton,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton, // Import Skeleton
  TextField,
  Typography,
} from "@mui/material";
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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link as RouterLink } from "react-router-dom";
import { useNdk } from "../contexts/NdkContext";
import { MarkdownContent } from "./MarkdownContent";
import { ReportPostDialog } from "./ReportPostDialog";

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
  tags: string[][],
): { isSensitive: boolean; reason: null | string } => {
  let isSensitive = false;
  let reason: null | string = null;
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

  const { ndk, signer, user: loggedInUser } = useNdk();
  // const navigate = useNavigate();
  const [authorUser, setAuthorUser] = useState<null | NDKUser>(null);
  const [authorProfile, setAuthorProfile] = useState<null | NDKUserProfile>(null);
  const [isLoadingAuthor, setIsLoadingAuthor] = useState<boolean>(true); // Initialize true
  const [isBlurred, setIsBlurred] = useState<boolean>(false);
  const [warningReason, setWarningReason] = useState<null | string>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState<null | boolean>(null);
  const [isMutingAuthor, setIsMutingAuthor] = useState<null | boolean>(null);
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
    [metadata.url],
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
      console.log(`ImagePost (${event.id}): Fetching profile for ${event.pubkey}`);
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
            console.log(`ImagePost (${event.id}): Profile fetched for ${event.pubkey}`, profile);
            setAuthorProfile(profile);
          }
        })
        .catch((err) => {
          if (isMounted)
            console.error(`ImagePost (${event.id}): Failed profile fetch ${event.pubkey}:`, err);
        })
        .finally(() => {
          if (isMounted) {
            console.log(
              `ImagePost (${event.id}): Finished profile fetch attempt for ${event.pubkey}`,
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
        author: event.pubkey,
        id: event.id,
        relays: event.relay ? [event.relay.url] : undefined,
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
          authors: [loggedInUser.pubkey],
          kinds: [CONTACT_LIST_KIND],
          limit: 1,
        };
        const contactListEvent = await ndk.fetchEvent(contactFilter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        if (isMounted) {
          const foundFollow = !!contactListEvent?.tags.some(
            (t) => t[0] === "p" && t[1] === authorPubkey,
          );
          setIsFollowingAuthor(foundFollow);
        }
        const muteFilter: NDKFilter = {
          authors: [loggedInUser.pubkey],
          kinds: [MUTE_LIST_KIND],
          limit: 1,
        };
        const muteListEvent = await ndk.fetchEvent(muteFilter, {
          cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        if (isMounted) {
          const foundMute = !!muteListEvent?.tags.some(
            (t) => t[0] === "p" && t[1] === authorPubkey,
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
                { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST },
              )
              .catch(() => null),
            ndk
              .fetchEvent(
                { ...boostFilter, authors: [userPubkey], limit: 1 },
                { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST },
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
            const descriptionTag = zapReceiptEvent.tags.find((t) => t[0] === "description");
            if (descriptionTag && descriptionTag[1]) {
              const zapRequestString = descriptionTag[1];
              const zapRequestData = JSON.parse(zapRequestString);
              const zapRequestTags = zapRequestData.tags || [];
              const bolt11Tag = zapRequestTags.find((t: string[]) => t[0] === "bolt11");
              if (bolt11Tag && bolt11Tag[1]) {
                const bolt11Invoice = bolt11Tag[1];
                const decodedInvoice = decode(bolt11Invoice);
                const amountSection = decodedInvoice.sections?.find((s) => s.name === "amount");
                if (amountSection?.value && typeof amountSection.value === "number") {
                  totalSats += amountSection.value / 1000;
                } else if (amountSection?.value && typeof amountSection.value === "string") {
                  try {
                    totalSats += parseInt(amountSection.value, 10) / 1000;
                  } catch (e) {}
                }
              }
            }
          } catch (e) {
            console.error(`Error processing zap event: ${zapReceiptEvent.id}`, e);
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
        "#e": [event.id],
        kinds: [1111],
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
          authors: authorPubkeys,
          kinds: [0],
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
    if (!ndk || !signer || !loggedInUser || !newCommentText.trim() || !event?.id || !event?.pubkey)
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
      toast.error(`Comment failed: ${error instanceof Error ? error.message : "Unknown"}`, {
        id: toastId,
      });
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
      toast.error(`Like failed: ${error instanceof Error ? error.message : "Unknown"}`, {
        id: toastId,
      });
    } finally {
      setIsProcessingLike(false);
    }
  }, [ndk, signer, loggedInUser, event.id, event.pubkey, hasLiked, isProcessingLike]);
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
      toast.error(`Boost failed: ${error instanceof Error ? error.message : "Unknown"}`, {
        id: toastId,
      });
    } finally {
      setIsProcessingBoost(false);
    }
  }, [ndk, signer, loggedInUser, event.id, event.pubkey, hasBoosted, isProcessingBoost]);
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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
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
          text: shareText,
          title: shareTitle,
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
        authors: [loggedInUser.pubkey],
        kinds: [CONTACT_LIST_KIND],
        limit: 1,
      };
      const currentContactListEvent = await ndk.fetchEvent(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      });
      let currentTags: string[][] = currentContactListEvent ? currentContactListEvent.tags : [];
      let newTags: string[][] = [];
      if (currentlyFollowing) {
        newTags = currentTags.filter((tag) => !(tag[0] === "p" && tag[1] === targetPubkey));
      } else {
        if (!currentTags.some((tag) => tag[0] === "p" && tag[1] === targetPubkey)) {
          newTags = [...currentTags, ["p", targetPubkey]];
        } else {
          newTags = currentTags;
        }
      }
      if (newTags.length === currentTags.length && currentlyFollowing === false) {
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
        authors: [loggedInUser.pubkey],
        kinds: [MUTE_LIST_KIND],
        limit: 1,
      };
      const currentMuteListEvent = await ndk.fetchEvent(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
      });
      let currentTags: string[][] = currentMuteListEvent ? currentMuteListEvent.tags : [];
      let newTags: string[][] = [];
      if (currentlyMuted) {
        newTags = currentTags.filter((tag) => !(tag[0] === "p" && tag[1] === targetPubkey));
      } else {
        if (!currentTags.some((tag) => tag[0] === "p" && tag[1] === targetPubkey)) {
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
        `Failed to submit report: ${error instanceof Error ? error.message : String(error)}`,
        { id: reportToastId },
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
    console.log(`Rendering Skeleton for event ${event.id} because isLoadingAuthor is true`);
    return (
      <Card elevation={2} sx={{ mb: { sm: 3, xs: 2 } }}>
        <CardHeader
          avatar={<Skeleton animation="wave" height={40} variant="circular" width={40} />}
          subheader={<Skeleton animation="wave" height={10} width="20%" />}
          title={<Skeleton animation="wave" height={10} style={{ marginBottom: 6 }} width="40%" />}
        />
        <Skeleton animation="wave" sx={{ height: 300 }} variant="rectangular" />
        <CardContent>
          <Skeleton animation="wave" height={10} style={{ marginBottom: 6 }} />
          <Skeleton animation="wave" height={10} width="80%" />
        </CardContent>
      </Card>
    );
  }

  // Condition 3: If loading finished, but authorUser still wasn\'t set
  if (!authorUser) {
    console.warn(`Skipping render: authorUser is null after loading attempt for event ${event.id}`);
    return null; // Or render an error placeholder
  }

  // --- Proceed with rendering now that authorUser is available ---
  const authorDisplayName =
    authorProfile?.displayName || authorProfile?.name || authorUser.npub.substring(0, 10) + "...";
  const authorAvatarUrl = authorProfile?.image?.startsWith("http")
    ? authorProfile.image
    : undefined;
  const isMenuOpen = Boolean(anchorEl);
  const isOwnPost = loggedInUser?.pubkey === event.pubkey;

  return (
    <Card
      elevation={2}
      sx={{
        mb: { sm: 3, xs: 2 },
        // Removed maxWidth, mx, overflow - Let container handle sizing
      }}
    >
      <CardHeader
        action={
          (loggedInUser || neventId) && (
            <>
              {" "}
              <IconButton
                aria-controls={isMenuOpen ? `post-action-menu-${event.id}` : undefined}
                aria-expanded={isMenuOpen ? "true" : undefined}
                aria-haspopup="true"
                aria-label="settings"
                id={`post-actions-button-${event.id}`}
                onClick={handleMenuOpen}
              >
                {" "}
                <MoreVertIcon />{" "}
              </IconButton>{" "}
              <Menu
                MenuListProps={{
                  "aria-labelledby": `post-actions-button-${event.id}`,
                }}
                anchorEl={anchorEl}
                id={`post-action-menu-${event.id}`}
                onClose={handleMenuClose}
                open={isMenuOpen}
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
                    disabled={isFollowingAuthor === null || isProcessingFollow}
                    onClick={handleFollowToggle}
                  >
                    {" "}
                    <ListItemIcon>
                      {" "}
                      {isProcessingFollow ? (
                        <CircularProgress color="inherit" size={20} />
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
                    disabled={isMutingAuthor === null || isProcessingMute}
                    onClick={handleMuteToggle}
                  >
                    {" "}
                    <ListItemIcon>
                      {" "}
                      {isProcessingMute ? (
                        <CircularProgress color="inherit" size={20} />
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
                  <MenuItem disabled={isSubmittingReport} onClick={handleReportClick}>
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
        avatar={
          <Avatar
            aria-label="author avatar"
            component={RouterLink}
            src={authorAvatarUrl}
            to={`/profile/${authorUser.npub}`}
          >
            {" "}
            {!authorAvatarUrl && authorDisplayName.charAt(0).toUpperCase()}{" "}
          </Avatar>
        }
        subheader={new Date(event.created_at! * 1000).toLocaleString()}
        title={
          <Link
            color="inherit"
            component={RouterLink}
            to={`/profile/${authorUser.npub}`}
            underline="hover"
          >
            {" "}
            {authorDisplayName}{" "}
          </Link>
        }
      />
      <Box
        onClick={handleImageClick}
        sx={{
          cursor: isBlurred ? "pointer" : "default",
          display: "flex",
          flexDirection: "column",
          gap: 2, // spacing between multiple images
          mt: 2,
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        {validImageUrls.map((url, index) => (
          <CardMedia
            alt={altText}
            component="img"
            image={url}
            key={index}
            sx={{
              borderRadius: 1,
              display: "block",
              filter: isBlurred ? "blur(25px)" : "none",
              maxHeight: "80vh",
              objectFit: "contain",
              transition: "filter 0.3s ease-in-out",
              width: "100%",
            }}
          />
        ))}

        {isBlurred && (
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "rgba(0, 0, 0, 0.5)",
              bottom: 0,
              color: "white",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              left: 0,
              p: 2,
              position: "absolute",
              right: 0,
              textAlign: "center",
              top: 0,
              zIndex: 1,
            }}
          >
            <VisibilityOffIcon sx={{ fontSize: 40, mb: 1 }} />
            <Typography gutterBottom variant="body1">
              {warningReason || "Content Warning"}
            </Typography>
            <Typography variant="caption">View content</Typography>
          </Box>
        )}
      </Box>

      {event.content && (
        <CardContent sx={{ pb: "8px !important", pt: 1 }}>
          <Typography color="text.secondary" variant="body2">
            <MarkdownContent content={event.content || ""} />
          </Typography>
        </CardContent>
      )}

      <CardActions disableSpacing sx={{ justifyContent: "space-around", pt: 0 }}>
        <Button
          disabled={!loggedInUser || isProcessingLike}
          onClick={handleLike}
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
          disabled={!loggedInUser || isProcessingBoost}
          onClick={handleBoost}
          size="small"
          startIcon={
            isProcessingBoost ? (
              <CircularProgress size={16} />
            ) : (
              <RepeatIcon color={hasBoosted ? "primary" : "inherit"} />
            )
          }
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
          onClick={handleReply}
          size="small"
          startIcon={<ChatBubbleOutlineIcon />}
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
          disabled={!loggedInUser || isProcessingZap || !authorProfile?.lud16}
          onClick={handleZap}
          size="small"
          startIcon={
            isProcessingZap ? (
              <CircularProgress size={16} />
            ) : (
              <BoltIcon sx={{ color: "#FFC107" }} />
            )
          }
          sx={{ minWidth: 63 }}
          title={!authorProfile?.lud16 ? "Author has no Lightning Address" : undefined}
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
        <CardContent sx={{ pb: "8px !important", pt: 0 }}>
          <Typography gutterBottom variant="h6">
            Comments
          </Typography>
          {isLoadingComments ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : comments.length > 0 ? (
            <Box>
              {comments.map((comment) => (
                <CommentItem commentEvent={comment} key={comment.id} ndk={ndk} />
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary" variant="body2">
              No comments yet.
            </Typography>
          )}
          {loggedInUser && (
            <Box sx={{ alignItems: "center", display: "flex", mt: 2 }}>
              <TextField
                fullWidth
                label="Add a comment"
                onChange={(e) => setNewCommentText(e.target.value)}
                size="small"
                sx={{ mr: 1 }}
                value={newCommentText}
                variant="outlined"
              />
              <Button disabled={!newCommentText.trim()} onClick={submitComment} variant="contained">
                Post
              </Button>
            </Box>
          )}
        </CardContent>
      </Collapse>

      {loggedInUser && (
        <ReportPostDialog
          event={event}
          onClose={handleCloseReportDialog}
          onSubmit={handleReportSubmit}
          open={isReportDialogOpen}
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
  const [authorProfile, setAuthorProfile] = useState<null | NDKUserProfile>(null);
  const authorUser = useMemo(
    () => ndk.getUser({ pubkey: commentEvent.pubkey }),
    [ndk, commentEvent.pubkey],
  );

  useEffect(() => {
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
    <Box
      sx={{
        alignItems: "flex-start",
        borderBottom: "1px solid #eee",
        display: "flex",
        mb: 1,
        pb: 1,
      }}
    >
      <Avatar src={authorAvatarUrl} sx={{ height: 24, mr: 1, width: 24 }}>
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
  if (amount < 1000000) return (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1) + "k";
  return (amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1) + "M";
};
