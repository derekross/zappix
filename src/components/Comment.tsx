import React, { useState, useEffect, useCallback } from "react";
import { NDKEvent, NDKUserProfile } from "@nostr-dev-kit/ndk";
import { useNdk } from "../contexts/NdkContext";
import { Link as RouterLink } from "react-router-dom"; // Use alias
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button"; // Use MUI Button

interface CommentProps {
  event: NDKEvent;
  onReply: (targetEvent: NDKEvent) => void;
}

export const Comment: React.FC<CommentProps> = ({ event, onReply }) => {
  const { signer } = useNdk();
  const [authorProfile, setAuthorProfile] = useState<NDKUserProfile | null>(null);

  useEffect(() => {
    if (event.author) {
      event.author
        .fetchProfile({ closeOnEose: true })
        .then(setAuthorProfile)
        .catch((err) => console.error("Failed profile fetch", err));
    }
  }, [event.author]);

  const authorDisplayName =
    authorProfile?.displayName || authorProfile?.name || event.pubkey.substring(0, 12);
  const authorPicture = authorProfile?.image;

  const handleReplyClick = useCallback(() => {
    onReply(event);
  }, [event, onReply]); // Added dependencies

  return (
    // Main container Box for the whole comment
    <Box
      sx={{
        borderTop: "1px solid",
        borderColor: "divider", // Use theme divider color
        padding: "8px 0 8px 2px", // Adjust padding
        marginTop: 1, // Use theme spacing unit
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5, // Add gap using theme spacing
      }}
    >
      {/* Avatar Section */}
      <RouterLink to={`/profile/${event.author.npub}`}>
        <Avatar
          src={authorPicture || undefined} // Pass undefined if null
          sx={{ width: 30, height: 30 }}
        >
          {!authorPicture ? authorDisplayName.charAt(0).toUpperCase() : null}
        </Avatar>
      </RouterLink>
      {/* Content Section */}
      <Box sx={{ flexGrow: 1 }}>
        {/* Author Name and Time */}
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <RouterLink
            to={`/profile/${event.author.npub}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {authorDisplayName}
            </Typography>
          </RouterLink>
          <Typography variant="caption" color="text.secondary">
            {new Date(event.created_at! * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Typography>
        </Box>
        {/* Comment Text */}
        <Typography
          variant="body2"
          sx={{ my: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {" "}
          {/* Allow line breaks */}
          {event.content}
        </Typography>
        {/* Reply Button */}
        {signer && (
          <Button
            size="small"
            onClick={handleReplyClick}
            sx={{
              fontSize: "0.75rem",
              p: "2px 4px", // Fine-tune padding
              textTransform: "none", // Prevent uppercase
              minWidth: "auto", // Allow smaller button
            }}
          >
            Reply
          </Button>
        )}
      </Box>{" "}
      {/* End of Content Box */}
    </Box> // End of Main container Box
  );
};
