// src/components/ImagePost.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { Link as RouterLink } from 'react-router-dom';
import { Card, CardHeader, CardMedia, CardContent, CardActions, Avatar, Typography, Box, IconButton, Chip, Link } from '@mui/material';
import { useNdk } from '../contexts/NdkContext';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import RepeatIcon from '@mui/icons-material/Repeat';
import ReplyIcon from '@mui/icons-material/Reply';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'; // Icon for blurred state

interface ImagePostProps {
    event: NDKEvent;
}

// Helper to parse imeta tag
const parseImetaTag = (tags: string[][]): Record<string, string> => {
    const imeta = tags.find(tag => tag[0] === 'imeta');
    if (!imeta) return {};
    const metaData: Record<string, string> = {};
    imeta.slice(1).forEach(part => {
        const spaceIndex = part.indexOf(' ');
        if (spaceIndex > 0) {
            const key = part.substring(0, spaceIndex);
            const value = part.substring(spaceIndex + 1);
            metaData[key] = value;
        }
    });
    return metaData;
};

// Helper to check for sensitive content tags
const checkSensitiveContent = (tags: string[][]): { isSensitive: boolean; reason: string | null } => {
    let isSensitive = false;
    let reason: string | null = null;

    for (const tag of tags) {
        if (tag[0] === 'content-warning') {
            isSensitive = true;
            reason = tag[1] || 'Sensitive Content'; // Use provided reason or default
            break; // Found CW, no need to check further
        }
        if (tag[0] === 't' && tag[1]?.toLowerCase() === 'nsfw') {
            isSensitive = true;
            reason = reason || 'NSFW'; // Use existing reason or set to NSFW
            // Don't break here, continue checking in case there's also a CW tag with a reason
        }
    }
    return { isSensitive, reason };
};

export const ImagePost: React.FC<ImagePostProps> = ({ event }) => {
    const { ndk } = useNdk();
    const [authorProfile, setAuthorProfile] = useState<any>(null);
    const [isBlurred, setIsBlurred] = useState<boolean>(false);
    const [warningReason, setWarningReason] = useState<string | null>(null);

    const metadata = useMemo(() => parseImetaTag(event.tags), [event.tags]);
    const imageUrl = metadata.url;
    const altText = event.tags.find(tag => tag[0] === 'alt')?.[1] || event.content || 'Nostr image post';

    // Effect to check for sensitive content on mount/event change
    useEffect(() => {
        const { isSensitive, reason } = checkSensitiveContent(event.tags);
        setIsBlurred(isSensitive);
        setWarningReason(reason);
    }, [event.tags]);

    // Fetch author profile
    useEffect(() => {
        if (ndk && event.pubkey) {
            const user = ndk.getUser({ pubkey: event.pubkey });
            user.fetchProfile().then(profile => {
                setAuthorProfile(profile);
            }).catch(err => console.error("Failed to fetch author profile", err));
        } else {
            setAuthorProfile(null);
        }
    }, [ndk, event.pubkey]);

    const handleImageClick = () => {
        if (isBlurred) {
            setIsBlurred(false);
        }
        // Potentially navigate to thread view or open modal later?
    };

    if (!imageUrl?.startsWith('http')) {
        // Optional: Render nothing or a placeholder if the image URL is invalid/missing
        console.warn(`Invalid or missing image URL in event ${event.id}`);
        return null; 
    }

    const authorDisplayName = authorProfile?.displayName || authorProfile?.name || event.pubkey.substring(0, 10) + '...';
    const authorAvatarUrl = authorProfile?.image?.startsWith('http') ? authorProfile.image : undefined;

    return (
        <Card elevation={2} sx={{ mb: 2 }}>
            <CardHeader
                avatar={
                    <Avatar 
                        component={RouterLink} 
                        to={`/profile/${event.author.npub}`} 
                        src={authorAvatarUrl} 
                        aria-label="author avatar"
                    >
                        {!authorAvatarUrl && authorDisplayName.charAt(0).toUpperCase()}
                    </Avatar>
                }
                title={
                    <Link component={RouterLink} to={`/profile/${event.author.npub}`} underline="hover" color="inherit">
                         {authorDisplayName}
                     </Link>
                 }
                subheader={new Date(event.created_at! * 1000).toLocaleString()}
            />
            <Box sx={{ position: 'relative', cursor: isBlurred ? 'pointer' : 'default' }} onClick={handleImageClick}>
                <CardMedia
                    component="img"
                    image={imageUrl}
                    alt={altText}
                    sx={{
                        maxHeight: '80vh', // Limit image height
                        objectFit: 'contain', // Fit image within bounds without cropping
                        width: '100%', 
                        filter: isBlurred ? 'blur(25px)' : 'none', // Apply blur if state is true
                        transition: 'filter 0.3s ease-in-out', // Smooth transition
                    }}
                />
                {/* Overlay for blurred state */} 
                {isBlurred && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: 'rgba(0, 0, 0, 0.5)', // Dark overlay
                            display: 'flex',
                            flexDirection: 'column', // Stack icon and text
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            textAlign: 'center',
                            p: 2,
                        }}
                    >
                        <VisibilityOffIcon sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="body1" gutterBottom>
                            {warningReason || 'Content Warning'} {/* Display reason or default */}
                        </Typography>
                        <Typography variant="caption">
                            Click to reveal
                        </Typography>
                    </Box>
                )}
            </Box>
            {(event.content || altText !== event.content) && (
                 <CardContent sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {altText} {/* Show alt text or content */}
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
                {/* Add other actions like zap, bookmark, etc. later */} 
            </CardActions>
        </Card>
    );
};
