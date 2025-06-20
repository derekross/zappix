import { useState, useRef, useEffect } from "react";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  MapPin,
  Hash,
  Eye,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { NostrEvent } from "@nostrify/nostrify";
import { useAuthorFast } from "@/hooks/useAuthorFast";
import {
  useReactions,
  useReactToPost,
  useRemoveReaction,
} from "@/hooks/useReactions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useComments } from "@/hooks/useComments";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { genUserName } from "@/lib/genUserName";
import { ImagePostActions } from "./ImagePostActions";
import { CommentSection } from "./CommentSection";
import { ZapButton } from "./ZapButton";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { nip19 } from "nostr-tools";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useOptionalVideoFeedContext } from "@/contexts/VideoFeedContext";
import { useInView } from "react-intersection-observer";

interface VideoPostProps {
  event: NostrEvent;
  className?: string;
  onHashtagClick?: (hashtag: string) => void;
  onLocationClick?: (location: string) => void;
}

export function VideoPost({
  event,
  className,
  onHashtagClick,
  onLocationClick,
}: VideoPostProps) {
  const [showComments, setShowComments] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Use video feed context for auto-play management
  const { 
    currentlyPlayingId, 
    setCurrentlyPlayingId, 
    globalMuteState, 
    setGlobalMuteState,
    isContextAvailable
  } = useOptionalVideoFeedContext();

  // Local state for when context is not available
  const [localCurrentlyPlayingId, setLocalCurrentlyPlayingId] = useState<string | null>(null);
  const [localGlobalMuteState, setLocalGlobalMuteState] = useState(true);

  // Determine which state to use based on context availability
  const effectiveCurrentlyPlayingId = isContextAvailable ? currentlyPlayingId : localCurrentlyPlayingId;
  const effectiveSetCurrentlyPlayingId = isContextAvailable ? setCurrentlyPlayingId : setLocalCurrentlyPlayingId;
  const effectiveGlobalMuteState = isContextAvailable ? globalMuteState : localGlobalMuteState;
  const effectiveSetGlobalMuteState = isContextAvailable ? setGlobalMuteState : setLocalGlobalMuteState;

  // Local mute state that syncs with global state
  const [isMuted, setIsMuted] = useState(effectiveGlobalMuteState);

  // Intersection observer for auto-play
  const { ref: containerRef, inView } = useInView({
    threshold: 0.5, // Video needs to be 50% visible to auto-play
    rootMargin: "0px",
  });

  const { user } = useCurrentUser();
  const { toast } = useToast();
  const author = useAuthorFast(event.pubkey);
  const reactions = useReactions(event.id);
  const comments = useComments(event.id, event.pubkey);
  const reactToPost = useReactToPost();
  const removeReaction = useRemoveReaction();

  const { displayName, profileImage } = author;

  // Parse event data
  const title = event.tags.find(([name]) => name === "title")?.[1] || "";
  const imetaTags = event.tags.filter(([name]) => name === "imeta");
  const hashtags = event.tags
    .filter(([name]) => name === "t")
    .map(([, tag]) => tag);
  const location = event.tags.find(([name]) => name === "location")?.[1];
  const geohash = event.tags.find(([name]) => name === "g")?.[1];
  const contentWarning = event.tags.find(
    ([name]) => name === "content-warning"
  )?.[1];
  const duration = event.tags.find(([name]) => name === "duration")?.[1];
  const _alt = event.tags.find(([name]) => name === "alt")?.[1];

  // Parse video URLs from vertical video events
  let videos: Array<{ url?: string; mimeType?: string; dimensions?: string; thumbnail?: string; duration?: string }> = [];

  if (event.kind === 22) {
    // NIP-71 short-form video format with imeta tags
    videos = imetaTags
      .map((tag) => {
        // Parse the imeta tag which contains space-separated key-value pairs
        const tagContent = tag.slice(1).join(" ");
        
        // Extract URL
        const urlMatch = tagContent.match(/url\s+(\S+)/);
        const url = urlMatch?.[1];
        
        // Extract MIME type
        const mimeMatch = tagContent.match(/m\s+(\S+)/);
        const mimeType = mimeMatch?.[1];
        
        // Extract dimensions
        const dimMatch = tagContent.match(/dim\s+(\S+)/);
        const dimensions = dimMatch?.[1];
        
        // Extract thumbnail (can be 'thumb' or 'image')
        const thumbMatch = tagContent.match(/thumb\s+(\S+)/);
        const imageMatch = tagContent.match(/image\s+(\S+)/);
        const thumbnail = thumbMatch?.[1] || imageMatch?.[1];
        
        // Extract duration from imeta tag if present
        const durationMatch = tagContent.match(/duration\s+(\S+)/);
        const imetaDuration = durationMatch?.[1];

        return { url, mimeType, dimensions, thumbnail, duration: imetaDuration };
      })
      .filter((video) => video.url && (video.mimeType?.startsWith("video/") || video.mimeType === "application/x-mpegURL"));
  } else if (event.kind === 34236) {
    // Legacy vertical video format (kind 34236)
    videos = imetaTags
      .map((tag) => {
        // Parse the imeta tag which contains space-separated key-value pairs
        const tagContent = tag.slice(1).join(" ");
        
        // Extract URL
        const urlMatch = tagContent.match(/url\s+(\S+)/);
        const url = urlMatch?.[1];
        
        // Extract MIME type
        const mimeMatch = tagContent.match(/m\s+(\S+)/);
        const mimeType = mimeMatch?.[1];
        
        // Extract dimensions
        const dimMatch = tagContent.match(/dim\s+(\S+)/);
        const dimensions = dimMatch?.[1];
        
        // Extract size (for potential future use)
        const sizeMatch = tagContent.match(/size\s+(\S+)/);
        const _size = sizeMatch?.[1];
        
        // Extract hash (ox or x) (for potential future use)
        const oxMatch = tagContent.match(/ox\s+(\S+)/);
        const xMatch = tagContent.match(/x\s+(\S+)/);
        const _hash = oxMatch?.[1] || xMatch?.[1];

        return { url, mimeType, dimensions, thumbnail: undefined, duration: undefined };
      })
      .filter((video) => video.url && video.mimeType?.startsWith("video/"));
    
    // If no imeta videos found, try to construct from standalone tags
    if (videos.length === 0) {
      const mimeTag = event.tags.find(([name, value]) => name === "m" && value?.startsWith("video/"));
      const altTag = event.tags.find(([name]) => name === "alt");
      
      if (mimeTag && altTag) {
        // Extract URL from alt tag content
        const altContent = altTag[1] || "";
        const urlMatch = altContent.match(/(https?:\/\/[^\s]+\.mp4)/);
        if (urlMatch) {
          videos = [{
            url: urlMatch[1],
            mimeType: mimeTag[1],
            dimensions: undefined,
            thumbnail: undefined,
            duration: undefined
          }];
        }
      }
    }
  }

  const likeCount = reactions.data?.["+"]?.count || 0;
  const hasLiked = reactions.data?.["+"]?.hasReacted || false;
  // Get unique comment count (in case of duplicates across pages)
  const allComments =
    comments.data?.pages?.flatMap((page) => page.comments) || [];
  const uniqueCommentIds = new Set(allComments.map((c) => c.id));
  const commentCount = uniqueCommentIds.size;

  // Create nevent for linking to the post
  const nevent = nip19.neventEncode({
    id: event.id,
    author: event.pubkey,
  });

  // Create npub for linking to the user profile
  const npub = nip19.npubEncode(event.pubkey);

  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Toggle play/pause when clicking on the video
    if (videoRef.current && videoLoaded) {
      if (isPlaying) {
        // User manually paused the video
        setManuallyPaused(true);
        videoRef.current.pause();
        effectiveSetCurrentlyPlayingId(null);
      } else {
        // User manually played the video
        setManuallyPaused(false);
        effectiveSetCurrentlyPlayingId(event.id);
        videoRef.current.muted = effectiveGlobalMuteState;
        videoRef.current.play().catch(() => {
          // Handle play promise rejection
          effectiveSetCurrentlyPlayingId(null);
        });
      }
    }
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    // Prevent event bubbling
    e.stopPropagation();
    // Navigate to the user profile page
    navigate(`/${npub}`);
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Toggle play/pause when clicking the play button
    if (videoRef.current && videoLoaded) {
      if (isPlaying) {
        // User manually paused the video
        setManuallyPaused(true);
        videoRef.current.pause();
        setCurrentlyPlayingId(null);
      } else {
        // User manually played the video
        setManuallyPaused(false);
        effectiveSetCurrentlyPlayingId(event.id);
        videoRef.current.muted = effectiveGlobalMuteState;
        videoRef.current.play().catch(() => {
          // Handle play promise rejection
          setCurrentlyPlayingId(null);
        });
      }
    }
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to the individual post page when clicking title
    navigate(`/${nevent}`);
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMutedState = !isMuted;
    
    // Update global mute state so all videos use the same setting
    effectiveSetGlobalMuteState(newMutedState);
    setIsMuted(newMutedState);
    
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
    }
  };

  const handleVideoLoadedData = () => {
    setVideoLoaded(true);
    setVideoError(false);
  };

  const handleVideoError = () => {
    setVideoError(true);
    setVideoLoaded(false);
  };

  const handleVideoCanPlay = () => {
    setVideoLoaded(true);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to like posts",
        variant: "destructive",
      });
      return;
    }

    try {
      if (hasLiked) {
        await removeReaction.mutateAsync({
          eventId: event.id,
          reaction: "+",
        });
      } else {
        await reactToPost.mutateAsync({
          eventId: event.id,
          authorPubkey: event.pubkey,
          reaction: "+",
          kind: event.kind.toString(), // Support kind 22 and 34236
        });
      }
    } catch {
      toast({
        title: "Error",
        description: hasLiked ? "Failed to remove like" : "Failed to like post",
        variant: "destructive",
      });
    }
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onLocationClick && (location || geohash)) {
      onLocationClick(location || geohash || "");
    }
  };

  // Sync local mute state with global state
  useEffect(() => {
    setIsMuted(effectiveGlobalMuteState);
    if (videoRef.current) {
      videoRef.current.muted = effectiveGlobalMuteState;
    }
  }, [effectiveGlobalMuteState]);

  // Auto-play logic based on intersection observer
  useEffect(() => {
    if (!videoRef.current || !videoLoaded || videoError) return;

    const video = videoRef.current;
    const isCurrentlyPlaying = effectiveCurrentlyPlayingId === event.id;

    if (inView && !isCurrentlyPlaying && !manuallyPaused) {
      // This video is in view and not currently playing - start playing
      effectiveSetCurrentlyPlayingId(event.id);
      video.muted = effectiveGlobalMuteState;
      video.play().catch(() => {
        // Handle play promise rejection
        setIsPlaying(false);
      });
    } else if (!inView && isCurrentlyPlaying) {
      // This video is out of view and currently playing - pause it
      video.pause();
      effectiveSetCurrentlyPlayingId(null);
      // Reset manual pause state when video goes out of view
      // This allows auto-play to work again when scrolling back
      setManuallyPaused(false);
    }
  }, [inView, videoLoaded, videoError, effectiveCurrentlyPlayingId, event.id, effectiveSetCurrentlyPlayingId, effectiveGlobalMuteState, manuallyPaused]);

  // Update local playing state based on global state
  useEffect(() => {
    setIsPlaying(effectiveCurrentlyPlayingId === event.id);
  }, [effectiveCurrentlyPlayingId, event.id]);

  // Load video when container comes into view
  useEffect(() => {
    if (inView) {
      setShouldLoadVideo(true);
    }
  }, [inView]);

  if (videos.length === 0) return null;

  const primaryVideo = videos[0];

  // All videos are vertical for TikTok-style feed
  const aspectRatio = "aspect-[9/16]"; // Always use portrait aspect ratio

  // Format duration for display
  const formatDuration = (durationStr: string) => {
    const duration = parseFloat(durationStr);
    if (isNaN(duration)) return null;
    
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Use duration from imeta tag if available, otherwise fall back to duration tag
  const displayDuration = primaryVideo.duration || duration;

  return (
    <Card className={cn("overflow-hidden", isMobile && "mx-0 rounded-none border-x-0", className)}>
      <CardHeader className={cn("pb-3", isMobile && "px-2")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar
              className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
              onClick={handleProfileClick}
            >
              <AvatarImage 
                src={profileImage} 
                alt={displayName}
                loading="lazy"
              />
              <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p
                className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors"
                onClick={handleProfileClick}
              >
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(event.created_at * 1000).toLocaleDateString()}
              </p>
            </div>
          </div>

          <DropdownMenu open={showActions} onOpenChange={setShowActions}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <ImagePostActions
                event={event}
                onClose={() => setShowActions(false)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Content Warning */}
        {contentWarning && (
          <div className={cn("px-4 pb-3", isMobile && "px-2")}>
            <Badge variant="destructive" className="text-xs">
              Content Warning: {contentWarning}
            </Badge>
          </div>
        )}

        {/* Video */}
        <div 
          ref={containerRef}
          className={cn("relative bg-black overflow-hidden cursor-pointer group", aspectRatio)}
          onClick={handleVideoClick}
          title="Click to play/pause"
        >
          {/* Show thumbnail while video is loading or not yet visible */}
          {primaryVideo.thumbnail && (!shouldLoadVideo || (!videoLoaded && !videoError)) && (
            <>
              <img
                src={primaryVideo.thumbnail}
                alt="Video thumbnail"
                className={cn(
                  "absolute inset-0 w-full h-full object-cover",
                  contentWarning && !isRevealed && "blur-[40px]"
                )}
              />
              {/* Play button overlay on thumbnail */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <Play className="h-8 w-8 text-white ml-1" />
                </div>
              </div>
            </>
          )}
          
          {/* Only render video when it should be loaded */}
          {shouldLoadVideo && (
            <video
              ref={videoRef}
              key={primaryVideo.url} // Force re-render when URL changes
              src={primaryVideo.url}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-300",
                contentWarning && !isRevealed && "blur-[40px]",
                !videoLoaded && "opacity-0" // Hide video until loaded
              )}
              muted={isMuted}
              loop
              playsInline
              preload="metadata" // Load metadata when video element is created
              onPlay={() => {
                setIsPlaying(true);
                effectiveSetCurrentlyPlayingId(event.id);
              }}
              onPause={() => {
                setIsPlaying(false);
                if (effectiveCurrentlyPlayingId === event.id) {
                  effectiveSetCurrentlyPlayingId(null);
                }
              }}
              onLoadedData={handleVideoLoadedData}
              onCanPlay={handleVideoCanPlay}
              onError={handleVideoError}
            />
          )}

          {/* Loading indicator */}
          {shouldLoadVideo && !videoLoaded && !videoError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* Error state */}
          {videoError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-white">
                <p className="text-sm">Failed to load video</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (videoRef.current) {
                      videoRef.current.load();
                      setVideoError(false);
                    }
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Video Controls Overlay - only show when video is loaded */}
          {videoLoaded && !videoError && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Top right corner - Mute/Unmute button */}
              <div className="absolute top-4 right-4 pointer-events-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMuteToggle}
                  className="text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm"
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
              </div>

              {/* Center - Play button (only show when paused) */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={handlePlayPause}
                    className="text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm w-16 h-16 rounded-full"
                  >
                    <Play className="h-8 w-8 ml-1" />
                  </Button>
                </div>
              )}

              {/* Bottom left corner - Duration (if available) */}
              {displayDuration && (
                <div className="absolute bottom-4 left-4 pointer-events-none">
                  <span className="text-white text-sm bg-black/30 backdrop-blur-sm px-2 py-1 rounded">
                    {formatDuration(displayDuration)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Reveal overlay for content warnings */}
          {contentWarning && !isRevealed && (
            <div
              className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsRevealed(true);
              }}
            >
              <div className="text-center text-white space-y-2">
                <Eye className="h-8 w-8 mx-auto" />
                <p className="text-sm font-medium">Click to reveal content</p>
                <p className="text-xs opacity-80">
                  Content warning: {contentWarning}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Post Content */}
        <div className={cn("p-4 space-y-3", isMobile && "px-2")}>
          {/* Title - for NIP-71 videos */}
          {title && (
            <h3
              className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors"
              onClick={handleTitleClick}
            >
              {title}
            </h3>
          )}

          {/* Description */}
          {event.content && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {event.content}
            </p>
          )}



          {/* Location */}
          {(location || geohash) && (
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <button
                type="button"
                className={cn(
                  "text-left hover:text-primary transition-colors",
                  onLocationClick ? "cursor-pointer" : "cursor-default"
                )}
                onClick={handleLocationClick}
                disabled={!onLocationClick}
              >
                {location || `Geohash: ${geohash}`}
              </button>
            </div>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className={cn(
                    "text-xs",
                    onHashtagClick &&
                      "cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors"
                  )}
                  onClick={
                    onHashtagClick
                      ? (e) => {
                          e.stopPropagation();
                          onHashtagClick(tag);
                        }
                      : undefined
                  }
                >
                  <Hash className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center space-x-1"
                onClick={handleLike}
                disabled={reactToPost.isPending || removeReaction.isPending}
              >
                <Heart
                  className={cn(
                    "h-4 w-4 transition-colors",
                    hasLiked
                      ? "fill-red-500 text-red-500"
                      : "text-muted-foreground hover:text-red-500"
                  )}
                />
                <span className="text-xs">{likeCount}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="flex items-center space-x-1"
                onClick={() => setShowComments(!showComments)}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs">{commentCount}</span>
              </Button>

              <ZapButton eventId={event.id} authorPubkey={event.pubkey} />
            </div>
          </div>
        </div>

        {/* Comments Section */}
        {showComments && (
          <CommentSection eventId={event.id} authorPubkey={event.pubkey} />
        )}
      </CardContent>
    </Card>
  );
}