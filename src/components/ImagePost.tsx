// src/components/ImagePost.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { NDKEvent, NDKKind, NDKSubscriptionCacheUsage, NDKFilter, NDKUserProfile, NDKZapInvoice, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { useNdk } from '../contexts/NdkContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardMedia, CardActions, Avatar, IconButton, Typography, Skeleton, Box, Chip, Tooltip, Alert, Menu, MenuItem, TextField, Button as MuiButton, CircularProgress } from '@mui/material'; // Added CircularProgress
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import RepeatIcon from '@mui/icons-material/Repeat';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BoltIcon from '@mui/icons-material/Bolt'; // Zap Icon
import ShareIcon from '@mui/icons-material/Share'; // Share Icon
import MoreVertIcon from '@mui/icons-material/MoreVert'; // More options icon
import SendIcon from '@mui/icons-material/Send'; // Send icon for comment button
import { nip19 } from 'nostr-tools';
import { MarkdownContent } from './MarkdownContent';
import { formatTimestamp } from '../utils/formatTimestamp';
import toast from 'react-hot-toast';

const IMAGE_POST_KIND = 20; // The kind used for these image posts (Explicitly 20)
const BOOKMARK_LIST_KIND = 30001; // NIP-33 Parameterized Replaceable Event for Bookmarks
const COMMENT_KIND = 1111; // Custom kind for comments on image posts

interface ImagePostProps {
    event: NDKEvent; // Expecting Kind 20 with imeta tags
}

export const ImagePost: React.FC<ImagePostProps> = ({ event }) => {
    const { ndk, user, signer } = useNdk();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true); // Overall loading state
    const [authorProfile, setAuthorProfile] = useState<NDKUserProfile | null>(null);
    const [likeCount, setLikeCount] = useState(0);
    const [repostCount, setRepostCount] = useState(0);
    const [replyCount, setReplyCount] = useState(0);
    const [userHasLiked, setUserHasLiked] = useState(false);
    const [userHasReposted, setUserHasReposted] = useState(false);
    const [userHasBookmarked, setUserHasBookmarked] = useState(false); // New state for bookmark status
    const [isEventValid, setIsEventValid] = useState(false);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null); // For share menu
    const [showComments, setShowComments] = useState(false); // New state to toggle comment section
    const [fetchedComments, setFetchedComments] = useState<NDKEvent[]>([]); // State to store fetched comments
    const [isLoadingComments, setIsLoadingComments] = useState(false); // Loading state for comments
    const [newCommentContent, setNewCommentContent] = useState(''); // State for new comment input
    const [zapTotalAmountMsats, setZapTotalAmountMsats] = useState(0); // New state for zap total
    const [userHasZappedThisPost, setUserHasZappedThisPost] = useState(false); // Track if user zapped this post in this session
    const [commentAuthorProfiles, setCommentAuthorProfiles] = useState<Record<string, NDKUserProfile | null>>({}); // State for comment author profiles

    // --- Validate Event and Extract Data --- 
    useEffect(() => {
        setIsLoading(true);
        setImageUrls([]);
        setAuthorProfile(null);
        setIsEventValid(false); // Assume invalid until validated

        // Strict validation: Must be Kind 20
        const isValid = event && 
                        event.kind === IMAGE_POST_KIND && 
                        event.id && 
                        event.author?.pubkey;

        if (!isValid) {
            console.warn(`ImagePost: Invalid or non-matching event received (Expected Kind ${IMAGE_POST_KIND}):`, event);
            setIsLoading(false);
            setIsEventValid(false);
            return;
        }

        setIsEventValid(true);
        console.log(`ImagePost (${event.id}): Processing valid Kind ${event.kind} event.`);

        // Extract Image URLs from imeta tags
        const extractedUrls: string[] = [];
        event.tags.forEach(tag => {
            if (tag[0] === 'imeta' && tag.length > 1) {
                const imetaData = tag.slice(1).join(' ');
                const urlMatch = imetaData.match(/url\s+(https?:\/\/[^\s]+)/i);
                if (urlMatch && urlMatch[1]) {
                    extractedUrls.push(urlMatch[1]);
                }
            }
        });
        setImageUrls(extractedUrls);
        if (extractedUrls.length === 0) {
             console.warn(`ImagePost (${event.id}): No image URL found in imeta tags for Kind ${IMAGE_POST_KIND}.`);
        }

        // Fetch Author Profile
        if (event.author) {
            event.author.fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST })
                .then(profile => setAuthorProfile(profile))
                .catch(err => console.error("Error fetching profile for ImagePost:", err))
                .finally(() => setIsLoading(false));
        } else {
             setIsLoading(false);
        }

    }, [event?.id, event?.kind, event?.author?.pubkey, event?.tags]);

    // --- Fetch Reactions/Boosts/Replies and Bookmark Status for THIS Kind 20 event --- 
    useEffect(() => {
        if (!ndk || !user || !event?.id || !isEventValid) return; // Need logged-in user for reaction status and bookmarks
        setLikeCount(0); setRepostCount(0); setReplyCount(0);
        setUserHasLiked(false); setUserHasReposted(false); setUserHasBookmarked(false);

        const fetchInteractionStatus = async () => {
            const filters: NDKFilter[] = [
                { // Reactions (Likes)
                 kinds: [NDKKind.Reaction],
                 '#e': [event.id],
                },
                { // Reposts (Boosts of this Kind 20 event)
                 kinds: [NDKKind.Repost],
                 '#e': [event.id],
                },
                 { // Replies (Kind 1 or custom Kind 11111 tagging this event)
                     kinds: [NDKKind.Text, COMMENT_KIND as NDKKind],
                     '#e': [event.id],
                 },
                 { // Zap Receipts (Kind 9735 tagging this event)
                     kinds: [9735 as NDKKind],
                     '#e': [event.id],
                 }
            ];
             // Filter to check if *this* user has liked/reposted
            if (user?.pubkey) {
                filters.push({
                    kinds: [NDKKind.Reaction, NDKKind.Repost],
                    '#e': [event.id],
                    authors: [user.pubkey],
                    limit: 2, // Max 2 events (1 like, 1 repost)
                });
            }

            let likes = 0, reposts = 0, replies = 0, totalZappedMsats = 0;
            let userLiked = false, userReposted = false;
            
            try {
                // Fetch all relevant interactions
                const interactions = await ndk.fetchEvents(filters, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });

                interactions.forEach(interactEvent => {
                    if (interactEvent.kind === NDKKind.Reaction && (interactEvent.content === '+' || interactEvent.content === '👍')) { likes++; if (user && interactEvent.pubkey === user.pubkey) userLiked = true; }
                    // Count Kind 6 reposts that tag this event (standard boosts)
                    else if (interactEvent.kind === NDKKind.Repost && interactEvent.tags.some(t => t[0] === 'e' && t[1] === event.id)) { reposts++; if (user && interactEvent.pubkey === user.pubkey) userReposted = true; } 
                    // Count Kind 1 and custom Kind 11111 replies that tag this event
                    else if ((interactEvent.kind === NDKKind.Text || interactEvent.kind === COMMENT_KIND) && interactEvent.tags.some(t => t[0] === 'e' && t[1] === event.id)) { replies++; }
                    // Sum Zap amounts from Kind 9735 receipts tagging this event
                    else if (interactEvent.kind === 9735 && interactEvent.tags.some(t => t[0] === 'e' && t[1] === event.id)) {
                        const descriptionTag = interactEvent.tags.find(t => t[0] === 'description');
                        if (descriptionTag && descriptionTag[1]) {
                            try {
                                const zapRequestData = JSON.parse(descriptionTag[1]);
                                const amountTag = zapRequestData.tags?.find((t: string[]) => t[0] === 'amount');
                                if (amountTag && amountTag[1]) {
                                    totalZappedMsats += parseInt(amountTag[1], 10) || 0;
                                }
                            } catch (e) { console.warn("Failed to parse description tag in zap receipt:", descriptionTag[1], e); }
                        }
                    }
                });
                setLikeCount(likes); setRepostCount(reposts); setReplyCount(replies);
                setZapTotalAmountMsats(totalZappedMsats);
                setUserHasLiked(userLiked); setUserHasReposted(userReposted);

                 // Check bookmark status (Kind 30001)
                 // Assumes a single bookmark list with a specific d-tag, e.g., 'default' or user-specific
                 const bookmarkFilter: NDKFilter = {
                     kinds: [BOOKMARK_LIST_KIND as NDKKind],
                     authors: [user.pubkey],
                     // '#d': ['default'], // Optional: filter by a specific d-tag if used
                     limit: 1
                 };
                 const bookmarkEvent = await ndk.fetchEvent(bookmarkFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
                 if (bookmarkEvent) {
                     // Check if this event's id is in the bookmark list's 'e' tags
                     setUserHasBookmarked(bookmarkEvent.tags.some(t => t[0] === 'e' && t[1] === event.id));
                 }

            } catch (error) { console.error("Error fetching interaction status:", error); }
        };
        fetchInteractionStatus();
    }, [ndk, user, event?.id, isEventValid]); // Depend on user for personalized status

    // --- Fetch Comments (Kind 11111) when section is shown ---
    useEffect(() => {
        if (!ndk || !event?.id || !isEventValid || !showComments) return; // Only fetch if valid and section is shown

        const fetchCommentsAndProfiles = async () => {
            setIsLoadingComments(true);
            setFetchedComments([]); // Clear old comments
            setCommentAuthorProfiles({}); // Clear old profiles
            try {
                const commentFilter: NDKFilter = {
                    kinds: [COMMENT_KIND as NDKKind], // Fetch custom comment kind (1111)
                    '#e': [event.id],
                };
                 console.log(`ImagePost (${event.id}): Fetching Kind ${COMMENT_KIND} comments with filter:`, commentFilter);
                const fetched = await ndk.fetchEvents(commentFilter, { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
                const sortedComments = Array.from(fetched).sort((a, b) => a.created_at! - b.created_at!);
                setFetchedComments(sortedComments);
                 console.log(`ImagePost (${event.id}): Fetched ${sortedComments.length} Kind ${COMMENT_KIND} comments.`);

                // Now fetch profiles for the authors of these comments
                if (sortedComments.length > 0) {
                     const authorPubkeys = Array.from(new Set(sortedComments.map(c => c.pubkey).filter(Boolean))); // Unique pubkeys
                     if (authorPubkeys.length > 0) {
                         console.log(`ImagePost (${event.id}): Fetching profiles for ${authorPubkeys.length} comment authors...`);
                        // NDK doesn't have a direct fetchProfiles, so fetch one by one (or implement batching if needed)
                         const profiles: Record<string, NDKUserProfile | null> = {};
                        // Use Promise.all for concurrent fetching
                        await Promise.all(authorPubkeys.map(async (pubkey) => {
                            try {
                                const user = ndk.getUser({ pubkey });
                                profiles[pubkey] = await user.fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST });
                            } catch (profileError) {
                                console.warn(`Failed to fetch profile for comment author ${pubkey}:`, profileError);
                                profiles[pubkey] = null; // Store null if fetch fails
                            }
                        }));
                         setCommentAuthorProfiles(profiles);
                         console.log(`ImagePost (${event.id}): Finished fetching profiles for comments.`);
                    }
                }

            } catch (error) {
                console.error("Error fetching comments or profiles:", error);
                toast.error("Failed to fetch comments/profiles.");
            } finally {
                setIsLoadingComments(false);
            }
        };

        fetchCommentsAndProfiles();

        // TODO: Implement real-time subscription for new comments if needed
        // const sub = ndk.subscribe(commentFilter);
        // sub.on('event', event => { ... update fetchedComments state ... });
        // return () => sub.stop(); // Cleanup subscription

    }, [ndk, event?.id, isEventValid, showComments]); // Depend on showComments to trigger fetch


    // --- Action Handlers (Targeting THIS Kind 20 event) --- 
    const handleZap = async () => { 
        if (!ndk || !user || !signer || !event?.id || !event?.author?.pubkey) {
             toast.error("Cannot zap: not logged in, no signer, or no event/author info.");
             return;
         }

         // --- NIP-57 Zap Flow (Kind 9734 -> Callback -> Invoice) ---
         let targetUser = event.author;
         let lightningAddress: string | null = null;
         let lnurlPayUrl: string | null = null;

         try {
             // 1. Get Lightning Address & LNURL Pay URL from recipient's profile
             if (!targetUser.profile) {
                 console.log("NIP-57 Zap: Fetching profile for target user...");
                 await targetUser.fetchProfile();
             }
             lightningAddress = targetUser.profile?.lud16 || targetUser.profile?.lud06;
             lnurlPayUrl = targetUser.profile?.lud06; // Use lud06 for lnurl tag if available

             if (!lightningAddress) {
                 toast.error("Author has no lightning address (lud16/lud06).");
                 return;
             }
             console.log(`NIP-57 Zap: Found lightning address: ${lightningAddress}`);
             if (lnurlPayUrl) console.log(`NIP-57 Zap: Found LNURL: ${lnurlPayUrl}`);

             // 2. Fetch LNURL pay parameters from the lightning address endpoint
             const lnurlEndpoint = `https://${lightningAddress.split('@')[1]}/.well-known/lnurlp/${lightningAddress.split('@')[0]}`;
             console.log(`NIP-57 Zap: Fetching LNURL details from: ${lnurlEndpoint}`);
             const lnurlResponse = await fetch(lnurlEndpoint);
             if (!lnurlResponse.ok) {
                 throw new Error(`LNURL request failed (${lnurlResponse.status}): ${lnurlResponse.statusText}`);
             }
             const lnurlDetails = await lnurlResponse.json();
             console.log("NIP-57 Zap: Received LNURL details:", lnurlDetails);

             // Check for essential callback URL
             if (!lnurlDetails.callback) {
                 throw new Error("LNURL details missing callback URL.");
             }
             const callbackUrl = lnurlDetails.callback;
             
             // ---> Get Zap Amount: Use localStorage default or prompt user <--- 
             let zapAmountSats: number | null = null;
             const storedAmountSatsStr = localStorage.getItem('nostrImageAppDefaultZapAmount');
             const storedAmountSats = storedAmountSatsStr ? parseInt(storedAmountSatsStr, 10) : null;

             if (storedAmountSats && storedAmountSats > 0) {
                 zapAmountSats = storedAmountSats;
                 console.log(`NIP-57 Zap: Using default amount from localStorage: ${zapAmountSats} sats`);
             } else {
                 const promptedAmountStr = prompt("Enter Zap amount in sats (no default set):", "21"); // Default prompt to 21 sats
                 if (promptedAmountStr === null) { // User cancelled prompt
                     toast("Zap cancelled.");
                     return;
                 }
                 const promptedAmount = parseInt(promptedAmountStr, 10);
                 if (isNaN(promptedAmount) || promptedAmount <= 0) {
                     toast.error("Invalid Zap amount entered.");
                     return;
                 }
                 zapAmountSats = promptedAmount;
                 console.log(`NIP-57 Zap: Using prompted amount: ${zapAmountSats} sats`);
             }

             const zapAmountMsats = zapAmountSats * 1000;
             const zapComment = 'Zap!'; // Optional comment for the recipient

             // 3. Construct the Kind 9734 Zap Request Event object
             const zapRequestEvent = new NDKEvent(ndk);
             zapRequestEvent.kind = 9734;
             zapRequestEvent.content = zapComment;
             zapRequestEvent.tags = [
                 ['p', event.author.pubkey],
                 ['e', event.id], // Tag the event being zapped
                 ['amount', zapAmountMsats.toString()],
                 // Specify relays where the recipient should publish the Zap Receipt (Kind 9735)
                 // Use explicit relays from NDK config if available, otherwise fallback might be needed
                 ['relays', ...(ndk.explicitRelayUrls || Array.from(ndk.pool.connectedRelays().keys()).slice(0, 5))] 
             ];
             // Add optional lnurl tag if available from profile (lud06)
             if (lnurlPayUrl) {
                 zapRequestEvent.tags.push(['lnurl', lnurlPayUrl]);
             }

             // 4. Sign the Kind 9734 event using the NIP-07 signer
             console.log("NIP-57 Zap: Signing Kind 9734 event...", zapRequestEvent.rawEvent());
             await zapRequestEvent.sign(signer);
             if (!zapRequestEvent.sig) {
                 throw new Error("Signer failed to sign the Kind 9734 Zap Request.");
             }
             const signedEventObject = await zapRequestEvent.toNostrEvent(); // Get the final event structure

             // 5. Encode the *signed* event for the callback URL parameter
             const nostrParam = encodeURIComponent(JSON.stringify(signedEventObject));

             // 6. Make the HTTP GET request to the LNURL callback URL
             const amountParam = `amount=${zapAmountMsats}`;
             // Include lnurl parameter in callback if available (some services require it)
             const lnurlParam = lnurlPayUrl ? `&lnurl=${encodeURIComponent(lnurlPayUrl)}` : ''; 
             const callbackFullUrl = `${callbackUrl}${callbackUrl.includes('?') ? '&' : '?'}${amountParam}&nostr=${nostrParam}${lnurlParam}`;
             
             console.log(`NIP-57 Zap: Fetching invoice from callback: ${callbackUrl} with params...`);
             console.log(`  Amount: ${zapAmountMsats}`);
             // console.log(`  Nostr Param (decoded): ${JSON.stringify(signedEventObject)}`); // Log decoded for debugging

             const invoiceResponse = await fetch(callbackFullUrl);
             if (!invoiceResponse.ok) {
                 // Attempt to parse error response if possible
                 let errorReason = invoiceResponse.statusText;
                 try { const errorJson = await invoiceResponse.json(); errorReason = errorJson.reason || errorReason; } catch (e) {}
                 throw new Error(`Callback request failed (${invoiceResponse.status}): ${errorReason}`);
             }
             const invoiceDetails = await invoiceResponse.json();
             console.log("NIP-57 Zap: Received invoice details:", invoiceDetails);

             if (invoiceDetails.status === 'ERROR' || !invoiceDetails.pr) {
                 throw new Error(`Zap callback error: ${invoiceDetails.reason || 'No invoice (pr) received'}`);
             }
             const bolt11Invoice = invoiceDetails.pr;

             // 7. Trigger Wallet Payment using the received BOLT11 invoice
             console.log(`NIP-57 Zap: Received invoice: ${bolt11Invoice}`);
             toast.success('Received Zap invoice! Please pay in your wallet.');
             
             // Standard way to trigger the default lightning handler
             window.open(`lightning:${bolt11Invoice}`);
             setUserHasZappedThisPost(true); // Set state to indicate zap initiated
             
             // Kind 9734 event is NOT published to relays by the sender.

         } catch (error: any) {
             console.error("NIP-57 Zap Error:", error);
             toast.error(`Zap Failed: ${error.message || error}`);
         }
     };

    const handleLike = async () => { 
        if (!ndk || !user || !signer || !event?.id) { toast.error("Cannot like: not logged in or no event ID."); return; }
         try {
             const likeEvent = new NDKEvent(ndk);
             likeEvent.kind = NDKKind.Reaction;
             likeEvent.content = '+'; // Or '👍'
             likeEvent.tags = [['e', event.id], ['p', event.pubkey]];

             await likeEvent.publish();
             toast.success(userHasLiked ? 'Unliked!' : 'Liked!');
             // Optimistically update UI, actual count update from subscription
             setUserHasLiked(!userHasLiked);
             setLikeCount(prev => userHasLiked ? prev - 1 : prev + 1);
             // --- DEBUG LOG --- 
             console.log('ImagePost: Publish call for Like event completed.', likeEvent);
             // --- END DEBUG LOG ---
         } catch (error: any) {
             toast.error(`Failed to ${userHasLiked ? 'unlike' : 'like'}: ${error.message || error}`);
         }
     };
    const handleRepost = async () => { 
        if (!ndk || !user || !signer || !event?.id) { toast.error("Cannot boost: not logged in or no event ID."); return; }
         try {
             // Publish a Kind 6 event referencing the Kind 20 event
             const repostEvent = new NDKEvent(ndk);
             repostEvent.kind = NDKKind.Repost; // This is Kind 6
             repostEvent.content = ''; // Reposts typically have empty content
             repostEvent.tags = [['e', event.id], ['p', event.pubkey]];

             await repostEvent.publish();
             toast.success(userHasReposted ? 'Undo Boosted!' : 'Boosted!');
             // Optimistically update UI
             setUserHasReposted(!userHasReposted);
             setRepostCount(prev => userHasReposted ? prev - 1 : prev + 1);
             // --- DEBUG LOG --- 
             console.log('ImagePost: Publish call for Repost event completed.', repostEvent);
             // --- END DEBUG LOG ---
         } catch (error: any) {
             toast.error(`Failed to ${userHasReposted ? 'undo boost' : 'boost'}: ${error.message || error}`);
         }
     };

    const handleReply = () => { 
        // Toggle the visibility of the comment section
        console.log(`ImagePost (${event?.id}): Comment icon clicked. Toggling comment section.`);
        setShowComments(prev => !prev);

        // Navigation to a separate thread page is no longer the primary action here,
        // but could be an option in the share menu or elsewhere if desired.
        // if(event?.id && event.author?.pubkey) {
        //    try { navigate(`/n/${event.encode()}`); } catch (e) { console.error("Error encoding nevent for reply navigation:", e)} 
        // }
    };

     const handlePublishComment = async () => {
         if (!ndk || !user || !signer || !event?.id || !event?.author?.pubkey || newCommentContent.trim() === '') {
             toast.error("Cannot publish empty comment or not logged in.");
             return;
         }
         try {
             const commentEvent = new NDKEvent(ndk);
             commentEvent.kind = COMMENT_KIND as NDKKind; // Use custom comment kind 11111
             commentEvent.content = newCommentContent.trim();
             // Tags for replying to the original Kind 20 post (NIP-10 format)
             commentEvent.tags = [
                 ['e', event.id, '', 'root'], // Original post as root
                 ['e', event.id, '', 'reply'], // Original post as immediate reply target
                 ['p', event.pubkey], // Original post author
             ];

             await commentEvent.publish(); // Publish the Kind 11111 event
             toast.success('Comment Published!');
             setNewCommentContent(''); // Clear input field
             // TODO: Optimistically add the new comment to fetchedComments state, or refetch comments.
             // Refetching is simpler for now, but less responsive.
             // Consider fetching comments again after successful publish to update the list.
             // fetchComments(); // You'd need to make fetchComments accessible or call it here

         } catch (error: any) {
             console.error("Error publishing comment:", error);
             toast.error(`Failed to publish comment: ${error.message || error}`);
         }
     };

     const handleBookmark = async () => {
        if (!ndk || !user || !signer || !event?.id) { toast.error("Cannot bookmark: not logged in or no event ID."); return; }

        try {
            // Fetch the current bookmark list (Kind 30001 with d-tag 'default' as example)
            const bookmarkFilter: NDKFilter = {
                kinds: [BOOKMARK_LIST_KIND as NDKKind],
                authors: [user.pubkey],
                // '#d': ['default'], // Use a specific d-tag if managing multiple lists
                limit: 1
            };
            const currentBookmarkEvent = await ndk.fetchEvent(bookmarkFilter, { cacheUsage: NDKSubscriptionCacheUsage.NETWORK_FIRST });

            const newBookmarkEvent = new NDKEvent(ndk);
            newBookmarkEvent.kind = BOOKMARK_LIST_KIND as NDKKind;
             newBookmarkEvent.tags = currentBookmarkEvent ? [...currentBookmarkEvent.tags.filter(t => t[0] !== 'e')] : []; // Copy existing tags excluding 'e'
             // newBookmarkEvent.tags.push(['d', 'default']); // Add d-tag if used
            newBookmarkEvent.content = currentBookmarkEvent?.content || ''; // Preserve existing content

            if (userHasBookmarked) {
                // Remove the event id from tags
                newBookmarkEvent.tags = newBookmarkEvent.tags.filter(t => !(t[0] === 'e' && t[1] === event.id));
            } else {
                // Add the event id to tags
                newBookmarkEvent.tags.push(['e', event.id]);
            }

            // This publish call seems incorrect, might need just .publish()
            await newBookmarkEvent.publish(); // Assuming bookmark publish doesn't need signer passed
            toast.success(userHasBookmarked ? 'Removed from bookmarks!' : 'Bookmarked!');
            setUserHasBookmarked(!userHasBookmarked);

        } catch (error: any) {
             console.error("Error saving bookmark:", error); // More specific error logging
            toast.error(`Failed to ${userHasBookmarked ? 'remove from bookmarks' : 'bookmark'}: ${error.message || error}`);
        }
    };

    const handleAvatarClick = () => { if(event?.author?.npub) navigate(`/profile/${event.author.npub}`); };

    const handleShareMenuClick = (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation(); // Prevent card click
        setAnchorEl(e.currentTarget);
     };

     const handleShareMenuClose = () => {
        setAnchorEl(null);
     };

     const handleCopyNpub = () => {
         if (event?.author?.npub) {
             navigator.clipboard.writeText(event.author.npub);
             toast.success('Author NPub copied!');
             handleShareMenuClose();
         }
     };

     const handleCopyNoteId = () => {
         const noteId = event?.id ? nip19.noteEncode(event.id) : null;
         if (noteId) {
             navigator.clipboard.writeText(noteId);
             toast.success('Note ID copied!');
             handleShareMenuClose();
         }
     };

     const handleCopyNevent = () => {
         if (event?.id && event.author?.pubkey) {
             try {
                 const relays = Array.from(ndk?.pool.connectedRelays() || []).map(r => r.url);
                  const neventId = nip19.neventEncode({
                      id: event.id,
                      author: event.author.pubkey,
                      relays: relays.length > 0 ? [relays[0]] : undefined // Include a relay if available
                  });
                 navigator.clipboard.writeText(neventId);
                 toast.success('Nevent copied!');
             } catch (e) { 
                 console.error("Error encoding nevent for copy:", e);
                 toast.error('Failed to copy nevent.');
             }
             handleShareMenuClose();
         }
     };
    
    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
         // Prevent navigating if a clickable element inside the card or the share menu was clicked
         if ((e.target as Element).closest('a, button, [role="button"], [aria-label], .share-menu-button')) return;
         // Navigation to a separate thread page is no longer the primary action here.
         // The Comment icon now toggles the inline comment section.
         // if(event?.id && event.author?.pubkey) {
         //    try { navigate(`/n/${event.encode()}`); } catch (e) { console.error("Error encoding nevent for card click:", e)} 
         // }
     };

    // --- Data Preparation --- 
    // Only prepare data if the event is valid
    const noteId = isEventValid && event?.id ? nip19.noteEncode(event.id) : null;
    let neventId = null;
     if (isEventValid && event?.id && event.author?.pubkey) {
         try {
             const relays = Array.from(ndk?.pool.connectedRelays() || []).map(r => r.url);
             neventId = nip19.neventEncode({
                 id: event.id,
                 author: event.author.pubkey,
                 relays: relays.length > 0 ? [relays[0]] : undefined
             });
         } catch (e) { console.warn("Could not encode nevent string for Kind 20:", e); neventId = noteId; } // Fallback to noteId
     } else { neventId = noteId; }

    const timestamp = isEventValid && event?.created_at ? formatTimestamp(event.created_at) : '';
    const profileImageUrl = authorProfile?.image?.startsWith('http') ? authorProfile.image : undefined;
    const authorDisplayName = authorProfile?.displayName || authorProfile?.name || (isEventValid && event?.author?.pubkey?.substring(0, 12)) || 'unknown';
    
    // --- Render Logic --- 
    // Show loading skeleton if still loading and event is not yet valid
    if (isLoading && !isEventValid) {
        return (
            <Card sx={{ mb: 2 }}>
                 <CardHeader avatar={<Skeleton animation="wave" variant="circular" width={40} height={40} />} title={<Skeleton animation="wave" height={10} width="40%" />} subheader={<Skeleton animation="wave" height={10} width="20%" />} />
                 <Skeleton sx={{ height: 190 }} animation="wave" variant="rectangular" />
                 <CardContent><Skeleton animation="wave" height={10} style={{ marginBottom: 6 }} /><Skeleton animation="wave" height={10} width="80%" /></CardContent>
                 <CardActions disableSpacing></CardActions>
             </Card>
        );
    }

    // Show error if event was determined to be invalid after loading check (should be rare with feed filtering)
    if (!isEventValid) {
        return (
            <Card sx={{ mb: 2 }}><CardContent><Alert severity="error">Invalid or unsupported event type for ImagePost.</Alert></CardContent></Card>
        );
    }

    // Main Render for a valid Kind 20 image post
    return (
        <Card sx={{ mb: 2, cursor: 'pointer' }} >
            {/* Card Header (Shows author of the Kind 20 event) */} 
            <CardHeader
                avatar={
                    <Avatar src={profileImageUrl} alt={authorDisplayName} onClick={(e) => { e.stopPropagation(); handleAvatarClick(); }} sx={{ cursor: 'pointer' }}>
                         {!profileImageUrl ? authorDisplayName.charAt(0)?.toUpperCase() : null}
                     </Avatar>
                }
                title={
                    <Typography fontWeight="bold" onClick={(e) => { e.stopPropagation(); handleAvatarClick(); }} sx={{ cursor: 'pointer' }}>
                        {authorDisplayName}
                    </Typography>
                }
                subheader={timestamp}
                action={
                    <IconButton aria-label="share" onClick={handleShareMenuClick} className="share-menu-button">
                        <ShareIcon />
                    </IconButton>
                }
            />
            {/* Card Media (Image) - Display the first found image */} 
            {imageUrls.length > 0 ? (
                <CardMedia 
                    component="img" 
                    sx={{ maxHeight: { xs: 300, sm: 400, md: 500 }, objectFit: 'contain', width: '100%', bgcolor: 'rgba(0,0,0,0.05)', cursor: 'pointer' }} 
                    image={imageUrls[0]} // Display the first extracted image URL
                    alt={`Image posted by ${authorDisplayName}`} 
                    onClick={handleCardClick} // Make image clickable
                />
            ) : (
                 <CardContent onClick={handleCardClick} sx={{cursor: 'pointer'}}><Alert severity="info" variant="outlined" sx={{border: 'none'}}>No image preview found (no imeta with url attribute).</Alert></CardContent>
            )}
            {/* Card Content (Uses event.content for description) */} 
            <CardContent onClick={handleCardClick} sx={{cursor: 'pointer'}}>
                 <MarkdownContent content={event.content || ''} />
                 {/* Display hashtag tags from the Kind 20 event */} 
                 <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }} onClick={(e) => e.stopPropagation()}> {/* Prevent card click on tags */}
                     {/* Filter for t tags; ensure tag[1] exists and is a string */}
                     {event.tags.filter(t => t[0] === 't' && typeof t[1] === 'string' && t[1].length > 0).map((tag, index) => (
                         <Chip key={index} label={`#${tag[1]}`} size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); navigate(`/t/${tag[1]}`); }}/>
                     ))}
                 </Box>
            </CardContent>
            {/* Card Actions */} 
            <CardActions disableSpacing>
                <Tooltip title="Zap"><span ><IconButton aria-label="zap" onClick={(e) => { e.stopPropagation(); handleZap(); }} disabled={!user || !(authorProfile?.lud16 || authorProfile?.lud06)}><BoltIcon color={userHasZappedThisPost ? "warning" : "inherit"} /><Typography variant="body2" sx={{ ml: 0.5 }}>{Math.floor(zapTotalAmountMsats / 1000)}</Typography></IconButton></span></Tooltip>
                <Tooltip title={userHasLiked ? "Unlike" : "Like"}><span ><IconButton aria-label="like" onClick={(e) => { e.stopPropagation(); handleLike(); }} disabled={!user || !signer}>{userHasLiked ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}<Typography variant="body2" sx={{ ml: 0.5 }}>{likeCount}</Typography></IconButton></span></Tooltip>
                <Tooltip title={userHasReposted ? "Undo Boost" : "Boost"}><span ><IconButton aria-label="repost" onClick={(e) => { e.stopPropagation(); handleRepost(); }} disabled={!user || !signer}>{userHasReposted ? <RepeatIcon color="success" /> : <RepeatIcon />}<Typography variant="body2" sx={{ ml: 0.5 }}>{repostCount}</Typography></IconButton></span></Tooltip>
                <Tooltip title="Comment"><IconButton aria-label="reply" onClick={(e) => { e.stopPropagation(); handleReply(); }}><ChatBubbleOutlineIcon /><Typography variant="body2" sx={{ ml: 0.5 }}>{replyCount}</Typography></IconButton></Tooltip>
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title={userHasBookmarked ? "Remove Bookmark" : "Bookmark"}><span ><IconButton aria-label="bookmark" onClick={(e) => { e.stopPropagation(); handleBookmark(); }} disabled={!user || !signer}>{userHasBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}</IconButton></span></Tooltip>
            </CardActions>

             {/* Share Menu */} 
             <Menu
                 anchorEl={anchorEl}
                 open={Boolean(anchorEl)}
                 onClose={handleShareMenuClose}
             >
                 <MenuItem onClick={handleCopyNoteId}>Copy Note ID</MenuItem>
                 <MenuItem onClick={handleCopyNevent}>Copy Nevent</MenuItem>
                 <MenuItem onClick={handleCopyNpub}>Copy Author NPub</MenuItem>
                 {/* Add more share options here if needed, e.g., direct link if available */}
                 {neventId && <MenuItem component="a" href={`https://njump.me/${neventId}`} target="_blank" rel="noopener noreferrer" onClick={handleShareMenuClose}>View on njump.me</MenuItem>}
             </Menu>

             {/* Comment Section - Implemented with Kind 11111 */}
             {showComments && (
                 <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.02)', mt: 1 }}>
                     <Typography variant="subtitle2" gutterBottom>{`Comments (${replyCount})`}</Typography>

                     {/* Loading Indicator for Comments */}
                     {isLoadingComments && <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>}

                     {/* Display Existing Comments */}
                     {!isLoadingComments && fetchedComments.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No comments yet.</Typography>}
                     
                     {!isLoadingComments && fetchedComments.length > 0 && (
                         <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                             {fetchedComments.map(commentEvent => {
                                 const authorPubkey = commentEvent.pubkey;
                                 const authorNpub = authorPubkey ? nip19.npubEncode(authorPubkey) : null;
                                 // Look up profile from state
                                 const profile = authorPubkey ? commentAuthorProfiles[authorPubkey] : null; 
                                 const displayName = profile?.displayName || profile?.name || authorPubkey?.substring(0, 10) || 'Unknown';
                                 const avatarUrl = profile?.image?.startsWith('http') ? profile.image : undefined;
                                 
                                 return (
                                     // TODO: Consider extracting into a separate CommentItem component
                                     <Box key={commentEvent.id} sx={{ borderBottom: '1px solid rgba(0,0,0,0.1)', pb: 1.5 }}>
                                         <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                             <Avatar 
                                                 src={avatarUrl} 
                                                 alt={displayName} 
                                                 sx={{ width: 24, height: 24, mr: 1, bgcolor: 'action.disabledBackground' }} // Added bgcolor fallback
                                                 onClick={(e) => { e.stopPropagation(); if (authorNpub) navigate(`/profile/${authorNpub}`); }}
                                                 style={{ cursor: authorNpub ? 'pointer' : 'default' }}
                                             >
                                                 {!avatarUrl ? displayName.charAt(0)?.toUpperCase() : null}
                                             </Avatar>
                                             <Typography 
                                                variant="body2" 
                                                fontWeight="bold" 
                                                sx={{ wordBreak: 'break-all', cursor: authorNpub ? 'pointer' : 'default' }}
                                                onClick={(e) => { e.stopPropagation(); if (authorNpub) navigate(`/profile/${authorNpub}`); }}
                                            >
                                                {displayName}
                                             </Typography>
                                         </Box>
                                         <Box sx={{ pl: '32px' }}> {/* Indent content */} 
                                             <MarkdownContent content={commentEvent.content || ''} />
                                             {/* TODO: Add reply button for replies to replies */}
                                         </Box>
                                     </Box>
                                 );
                             })}
                         </Box>
                     )}

                     {/* New Comment Input */}
                     {user && signer && (
                         <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                             <TextField
                                 fullWidth
                                 size="small"
                                 label="Add a comment"
                                 value={newCommentContent}
                                 onChange={(e) => setNewCommentContent(e.target.value)}
                                 variant="outlined"
                                 multiline
                                 maxRows={4}
                             />
                             <MuiButton 
                                 variant="contained" 
                                 onClick={handlePublishComment}
                                 disabled={!newCommentContent.trim()}
                                 endIcon={<SendIcon />}
                             >
                                 Send
                             </MuiButton>
                         </Box>
                     )} {!user && <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Log in to comment.</Typography>}
                 </Box>
             )}

        </Card>
    );
};
