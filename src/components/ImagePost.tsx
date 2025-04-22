// src/components/ImagePost.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { Link as RouterLink } from 'react-router-dom';
import { Card, CardHeader, CardMedia, CardContent, CardActions, Avatar, Typography, Box, IconButton, Chip, Link, Menu, MenuItem } from '@mui/material';
import { useNdk } from '../contexts/NdkContext';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import RepeatIcon from '@mui/icons-material/Repeat';
import ReplyIcon from '@mui/icons-material/Reply';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'; 
import { ReportPostDialog } from './ReportPostDialog'; 
import toast from 'react-hot-toast'; // Added toast

interface ImagePostProps {
    event: NDKEvent;
}

// Helper to parse imeta tag (Unchanged)
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

// Helper to check for sensitive content tags (Unchanged)
const checkSensitiveContent = (tags: string[][]): { isSensitive: boolean; reason: string | null } => {
    let isSensitive = false;
    let reason: string | null = null;
    for (const tag of tags) {
        if (tag[0] === 'content-warning') {
            isSensitive = true;
            reason = tag[1] || 'Sensitive Content'; 
            break; 
        }
        if (tag[0] === 't' && tag[1]?.toLowerCase() === 'nsfw') {
            isSensitive = true;
            reason = reason || 'NSFW'; 
        }
    }
    return { isSensitive, reason };
};

export const ImagePost: React.FC<ImagePostProps> = ({ event }) => {
    // Added signer to context usage
    const { ndk, user: loggedInUser, signer } = useNdk(); 
    const [authorProfile, setAuthorProfile] = useState<any>(null);
    const [isBlurred, setIsBlurred] = useState<boolean>(false);
    const [warningReason, setWarningReason] = useState<string | null>(null);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [isSubmittingReport, setIsSubmittingReport] = useState(false); // Loading state for report submit

    const metadata = useMemo(() => parseImetaTag(event.tags), [event.tags]);
    const imageUrl = metadata.url;
    const altText = event.tags.find(tag => tag[0] === 'alt')?.[1] || event.content || 'Nostr image post';

    useEffect(() => {
        const { isSensitive, reason } = checkSensitiveContent(event.tags);
        setIsBlurred(isSensitive);
        setWarningReason(reason);
    }, [event.tags]);

    useEffect(() => {
        if (ndk && event.pubkey) {
            const user = ndk.getUser({ pubkey: event.pubkey });
            user.fetchProfile().then(profile => setAuthorProfile(profile));
        }
    }, [ndk, event.pubkey]);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
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

    const handleCloseReportDialog = () => {
        setIsReportDialogOpen(false);
    };

    // --- NIP-56 Report Submission Logic ---
    const handleReportSubmit = async (reportType: string, reasonText: string) => {
        if (!ndk || !loggedInUser || !signer) {
            toast.error("Cannot submit report: NDK, user, or signer missing.");
            handleCloseReportDialog();
            return;
        }

        setIsSubmittingReport(true);
        const reportToastId = 'report-toast';
        toast.loading('Submitting report...', { id: reportToastId });

        try {
            // 1. Create Kind 1984 Event
            const reportEvent = new NDKEvent(ndk);
            reportEvent.kind = 1984; // Reporting kind
            reportEvent.created_at = Math.floor(Date.now() / 1000);
            
            // 2. Add Tags
            reportEvent.tags = [
                ['e', event.id], // Event being reported
                ['p', event.pubkey], // Author of the event being reported
                ['report', reportType] // Report type (nudity, spam, etc.)
            ];

            // 3. Add Content (optional reason text)
            reportEvent.content = reasonText || ''; // Use reasonText if provided

            // 4. Sign Event
            await reportEvent.sign(signer);
            console.log("Signed NIP-56 Report Event:", reportEvent.rawEvent());

            // 5. Publish Event
            const publishedRelays = await reportEvent.publish();

            if (publishedRelays.size > 0) {
                toast.success('Report submitted successfully!', { id: reportToastId });
                console.log(`Report for event ${event.id} published to ${publishedRelays.size} relays.`);
            } else {
                toast.error("Failed to publish report to any connected write relays.", { id: reportToastId });
                throw new Error("Publish failed");
            }

        } catch (error) {
            console.error("Error submitting NIP-56 report:", error);
            toast.error(`Failed to submit report: ${error instanceof Error ? error.message : String(error)}`, { id: reportToastId });
        } finally {
            setIsSubmittingReport(false);
            handleCloseReportDialog(); // Close dialog regardless of success/failure
        }
    };

    const handleImageClick = () => {
        if (isBlurred) {
            setIsBlurred(false);
        }
    };

    if (!imageUrl?.startsWith('http')) {
        return null; 
    }

    const authorDisplayName = authorProfile?.displayName || authorProfile?.name || event.pubkey.substring(0, 10) + '...';
    const authorAvatarUrl = authorProfile?.image?.startsWith('http') ? authorProfile.image : undefined;
    const isMenuOpen = Boolean(anchorEl);

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
                action={
                    <>
                        <IconButton aria-label="settings" onClick={handleMenuOpen}>
                            <MoreVertIcon />
                        </IconButton>
                        <Menu
                            id="post-action-menu"
                            anchorEl={anchorEl}
                            open={isMenuOpen}
                            onClose={handleMenuClose}
                            MenuListProps={{ 'aria-labelledby': 'basic-button' }}
                        >
                            <MenuItem onClick={handleReportClick} disabled={!loggedInUser}>
                                Report Post
                             </MenuItem>
                        </Menu>
                    </>
                }
                title={
                    <Link component={RouterLink} to={`/profile/${event.author.npub}`} underline="hover" color="inherit">
                         {authorDisplayName}
                     </Link>
                 }
                subheader={new Date(event.created_at! * 1000).toLocaleString()}
            />
            {/* ... (Rest of CardMedia, CardContent, CardActions remain the same) ... */}
             <Box sx={{ position: 'relative', cursor: isBlurred ? 'pointer' : 'default' }} onClick={handleImageClick}>
                <CardMedia
                    component="img"
                    image={imageUrl}
                    alt={altText}
                    sx={{
                        maxHeight: '80vh', 
                        objectFit: 'contain', 
                        width: '100%', 
                        filter: isBlurred ? 'blur(25px)' : 'none', 
                        transition: 'filter 0.3s ease-in-out',
                    }}
                />
                {isBlurred && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            textAlign: 'center',
                            p: 2,
                        }}
                    >
                        <VisibilityOffIcon sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="body1" gutterBottom>
                            {warningReason || 'Content Warning'}
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
                        {altText}
                     </Typography>
                 </CardContent>
             )}
            <CardActions disableSpacing sx={{ pt: 0 }}>
                <IconButton aria-label="like"><FavoriteBorderIcon /></IconButton>
                <IconButton aria-label="repost"><RepeatIcon /></IconButton>
                <IconButton aria-label="reply"><ReplyIcon /></IconButton>
            </CardActions>

            {/* Report Dialog - Passed the actual submit handler */}
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
