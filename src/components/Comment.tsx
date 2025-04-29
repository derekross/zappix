import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button"; // Use MUI Button
import Typography from "@mui/material/Typography";
import { NDKEvent, NDKUserProfile } from "@nostr-dev-kit/ndk";
import React, { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom"; // Use alias
import { useNdk } from "../contexts/NdkContext";

interface CommentProps {
  event: NDKEvent;
  onReply: (targetEvent: NDKEvent) => void;
}

export const Comment: React.FC<CommentProps> = ({ event, onReply }) => {
  const { signer } = useNdk();
  const [authorProfile, setAuthorProfile] = useState<null | NDKUserProfile>(null);

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
        alignItems: "flex-start",
        borderColor: "divider", // Use theme divider color
        borderTop: "1px solid",
        display: "flex",
        gap: 1.5, // Add gap using theme spacing
        marginTop: 1, // Use theme spacing unit
        padding: "8px 0 8px 2px", // Adjust padding
      }}
    >
      {/* Avatar Section */}
      <RouterLink to={`/profile/${event.author.npub}`}>
        <Avatar
          src={authorPicture || undefined} // Pass undefined if null
          sx={{ height: 30, width: 30 }}
        >
          {!authorPicture ? authorDisplayName.charAt(0).toUpperCase() : null}
        </Avatar>
      </RouterLink>
      {/* Content Section */}
      <Box sx={{ flexGrow: 1 }}>
        {/* Author Name and Time */}
        <Box sx={{ alignItems: "baseline", display: "flex", gap: 1 }}>
          <RouterLink
            style={{ color: "inherit", textDecoration: "none" }}
            to={`/profile/${event.author.npub}`}
          >
            <Typography sx={{ fontWeight: "bold" }} variant="body2">
              {authorDisplayName}
            </Typography>
          </RouterLink>
          <Typography color="text.secondary" variant="caption">
            {new Date(event.created_at! * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Typography>
        </Box>
        {/* Comment Text */}
        <Typography
          sx={{ my: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          variant="body2"
        >
          {" "}
          {/* Allow line breaks */}
          {event.content}
        </Typography>
        {/* Reply Button */}
        {signer && (
          <Button
            onClick={handleReplyClick}
            size="small"
            sx={{
              fontSize: "0.75rem",
              minWidth: "auto", // Allow smaller button
              p: "2px 4px", // Fine-tune padding
              textTransform: "none", // Prevent uppercase
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
