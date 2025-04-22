// src/pages/ThreadPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useNdk } from "../contexts/NdkContext";
// FIX: Remove nip19 from NDK import
import { NDKEvent, NDKFilter, NDKKind } from "@nostr-dev-kit/ndk";
// FIX: Add correct import for nip19
import { nip19 } from "nostr-tools";
import { ImagePost } from "../components/ImagePost"; // Assuming root might be ImagePost
// import { CommentComponent } from '../components/CommentComponent'; // Import your comment component
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider"; // Import Divider
import toast from "react-hot-toast";

const IMAGE_POST_KIND: NDKKind = 20;
const COMMENT_KIND: NDKKind = 1111; // Using Kind 1111 as per previous request

export const ThreadPage: React.FC = () => {
  const { nevent } = useParams<{ nevent: string }>();
  const { ndk, user: loggedInUser, signer, readRelays } = useNdk(); // Added readRelays
  const [rootEvent, setRootEvent] = useState<NDKEvent | null>(null);
  const [comments, setComments] = useState<NDKEvent[]>([]);
  const [isLoadingRoot, setIsLoadingRoot] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  // Store decoded pointer info
  const [rootEventId, setRootEventId] = useState<string | null>(null);
  const [rootEventKind, setRootEventKind] = useState<NDKKind | null>(null);
  const [rootEventPubkey, setRootEventPubkey] = useState<string | null>(null);
  const [rootRelays, setRootRelays] = useState<string[]>([]); // Store relays from nevent if needed

  // Decode nevent and fetch root event
  useEffect(() => {
    if (ndk && nevent) {
      setIsLoadingRoot(true);
      setRootEvent(null);
      setComments([]); // Reset
      setRootEventId(null);
      setRootEventKind(null);
      setRootEventPubkey(null);
      setRootRelays([]);

      try {
        const decoded = nip19.decode(nevent);
        if (decoded.type === "nevent") {
          const eventPointer = decoded.data;
          console.log("Decoded nevent:", eventPointer);
          setRootEventId(eventPointer.id);
          if (eventPointer.kind) setRootEventKind(eventPointer.kind); // Kind might be in pointer
          if (eventPointer.author) setRootEventPubkey(eventPointer.author);
          if (eventPointer.relays) setRootRelays(eventPointer.relays);

          // Fetch the root event using the pointer ID
          // Optionally use relays from pointer: { relaySet: NDKRelaySet.fromRelayUrls(eventPointer.relays, ndk) }
          ndk
            .fetchEvent(eventPointer.id)
            .then((event) => {
              if (event) {
                setRootEvent(event);
                // Update kind/pubkey from fetched event if not in pointer
                if (rootEventKind === null) setRootEventKind(event.kind);
                if (rootEventPubkey === null) setRootEventPubkey(event.pubkey);
              } else {
                toast.error("Could not find the root post.");
              }
            })
            .catch((err) => {
              console.error(err);
              toast.error("Error fetching root post.");
            })
            .finally(() => setIsLoadingRoot(false));
        } else {
          toast.error("Invalid event ID format (expected nevent).");
          setIsLoadingRoot(false);
        }
      } catch (error) {
        console.error("Error decoding nevent:", error);
        toast.error("Failed to decode event ID.");
        setIsLoadingRoot(false);
      }
    } else {
      setIsLoadingRoot(false); // Not loading if no NDK or nevent param
    }
  }, [ndk, nevent]);

  // Fetch comments when root event ID is known
  useEffect(() => {
    if (ndk && rootEventId) {
      setIsLoadingComments(true);
      const commentFilter: NDKFilter = {
        kinds: [COMMENT_KIND], // Fetch Kind 1111
        // NIP-22: Filter by uppercase E tag pointing to root event ID
        "#E": [rootEventId],
      };
      console.log("Fetching comments with filter:", commentFilter);
      ndk
        .fetchEvents(commentFilter)
        .then((fetchedComments) => {
          const sorted = Array.from(fetchedComments).sort(
            (a, b) => a.created_at! - b.created_at!
          ); // Oldest first
          console.log(`Fetched ${sorted.length} comments.`);
          setComments(sorted);
        })
        .catch((err) => {
          console.error(err);
          toast.error("Failed to load comments.");
        })
        .finally(() => setIsLoadingComments(false));
    } else {
      setComments([]); // Clear comments if no root event ID
      setIsLoadingComments(false);
    }
  }, [ndk, rootEventId]);

  // Handler to post a new Kind 1111 comment
  const handlePostComment = useCallback(async () => {
    // Ensure all required pieces are available
    if (
      !newComment.trim() ||
      !ndk ||
      !signer ||
      !rootEvent ||
      !rootEventId ||
      rootEventKind === null ||
      !rootEventPubkey ||
      !loggedInUser
    ) {
      toast.error("Cannot post comment. Missing data or login.");
      return;
    }
    setIsPostingComment(true);
    const toastId = toast.loading("Posting comment...");

    try {
      const commentEvent = new NDKEvent(ndk);
      commentEvent.kind = COMMENT_KIND;
      commentEvent.content = newComment.trim();
      commentEvent.created_at = Math.floor(Date.now() / 1000);

      // --- NIP-22 Tagging ---
      // Root scope tags (pointing to the image post)
      const rootTags = [
        // FIX: Remove extra empty string
        ["E", rootEventId, rootRelays?.[0] || "", rootEventPubkey], // Uppercase E for root event ID
        ["K", String(rootEventKind)], // Uppercase K for root kind
        ["P", rootEventPubkey], // Uppercase P for root author pubkey
      ];

      // Parent scope tags (for a top-level comment, parent is the root)
      const parentTags = [
        // FIX: Remove extra empty string
        ["e", rootEventId, rootRelays?.[0] || "", rootEventPubkey], // lowercase e for parent event ID
        ["k", String(rootEventKind)], // lowercase k for parent kind
        ["p", rootEventPubkey], // lowercase p for parent author pubkey
      ];

      // TODO: If implementing replies-to-replies, the parent tags would point
      // to the Kind 1111 comment being replied to. This requires more state management.

      commentEvent.tags = [...rootTags, ...parentTags];

      // Add own pubkey tag for identification (optional but good practice)
      commentEvent.tags.push(["p", loggedInUser.pubkey]);

      await commentEvent.sign(signer);
      const published = await commentEvent.publish(); // Publishes to user's write relays

      if (published.size > 0) {
        toast.success("Comment posted!", { id: toastId });
        setNewComment(""); // Clear input
        // Optimistically add to state
        setComments((prev) =>
          [...prev, commentEvent].sort((a, b) => a.created_at! - b.created_at!)
        );
      } else {
        toast.error("Failed to publish comment to any relay.", { id: toastId });
      }
    } catch (error: any) {
      console.error("Error posting comment:", error);
      toast.error(
        `Failed to post comment: ${error.message || "Unknown error"}`,
        { id: toastId }
      );
    } finally {
      setIsPostingComment(false);
    }
  }, [
    newComment,
    ndk,
    signer,
    rootEvent,
    rootEventId,
    rootEventKind,
    rootEventPubkey,
    loggedInUser,
    readRelays,
  ]); // Added readRelays dependency

  // --- RENDER LOGIC ---
  return (
    <Box sx={{ maxWidth: 700, mx: "auto" }}>
      {" "}
      {/* Adjust max width if needed */}
      {isLoadingRoot && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      )}
      {!isLoadingRoot && !rootEvent && (
        <Alert severity="error">Post not found or could not be loaded.</Alert>
      )}
      {rootEvent && (
        <>
          {/* Render the root post */}
          {/* Use ImagePost if it's kind 20, otherwise maybe a generic renderer */}
          {rootEvent.kind === IMAGE_POST_KIND ? (
            <ImagePost event={rootEvent} />
          ) : (
            <Box sx={{ p: 2, border: "1px dashed grey", mb: 2 }}>
              <Typography variant="h6">
                Unsupported Root Event (Kind: {rootEvent.kind})
              </Typography>
              <Typography
                variant="body2"
                sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {rootEvent.content}
              </Typography>
              {/* Render tags or other info if desired */}
            </Box>
          )}

          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" gutterBottom>
            Comments ({comments.length})
          </Typography>

          {isLoadingComments && (
            <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!isLoadingComments && comments.length === 0 && (
            <Typography sx={{ color: "text.secondary", my: 2 }}>
              No comments yet.
            </Typography>
          )}

          {/* Render Comments */}
          {!isLoadingComments &&
            comments.map((comment) => (
              // Replace with your dedicated CommentComponent later
              <Box
                key={comment.id}
                sx={{
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  pb: 1,
                  mb: 1,
                }}
              >
                <Typography
                  variant="caption"
                  component="div"
                  sx={{ fontWeight: "bold" }}
                >
                  {comment.author.profile?.displayName ||
                    comment.author.profile?.name ||
                    comment.author.npub.substring(0, 10)}
                  ...
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", ml: 1 }}
                  >
                    {new Date(comment.created_at! * 1000).toLocaleString()}
                  </Typography>
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    mt: 0.5,
                  }}
                >
                  {comment.content}
                </Typography>
                {/* Add reply button for threaded replies later */}
              </Box>
              // <CommentComponent commentEvent={comment} />
            ))}

          {/* Comment Input Form */}
          {loggedInUser && rootEvent && (
            <Box
              component="form"
              sx={{ mt: 3 }}
              onSubmit={(e) => {
                e.preventDefault();
                handlePostComment();
              }}
            >
              <TextField
                fullWidth
                multiline
                minRows={2} // Use minRows instead of fixed rows
                label="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={isPostingComment}
                variant="outlined" // Use outlined or filled
              />
              <Button
                type="submit"
                variant="contained"
                sx={{ mt: 1 }}
                disabled={isPostingComment || !newComment.trim()}
              >
                {isPostingComment ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Post Comment"
                )}
              </Button>
            </Box>
          )}
          {!loggedInUser &&
            rootEvent &&
            !isLoadingRoot && ( // Show only if root loaded
              <Alert severity="info" sx={{ mt: 2 }}>
                Log in to post a comment.
              </Alert>
            )}
        </>
      )}
    </Box>
  );
};
