import { useState, useRef } from "react";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  MapPin,
  Hash,
  Eye,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { NostrEvent } from "@nostrify/nostrify";
import { useAuthor } from "@/hooks/useAuthor";
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
import * as nip19 from "nostr-tools/nip19";

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
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  const { user } = useCurrentUser();
  const { toast } = useToast();
  const author = useAuthor(event.pubkey);
  const reactions = useReactions(event.id);
  const comments = useComments(event.id, event.pubkey);
  const reactToPost = useReactToPost();
  const removeReaction = useRemoveReaction();

  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(event.pubkey);
  const profileImage = metadata?.picture;

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
  const alt = event.tags.find(([name]) => name === "alt")?.[1];

  // Parse video URLs from imeta tags
  const videos = imetaTags
    .map((tag) => {
      const urlPart = tag.find((part) => part.startsWith("url "));
      const url = urlPart?.replace("url ", "");
      const mPart = tag.find((part) => part.startsWith("m "));
      const mimeType = mPart?.replace("m ", "");
      const dimPart = tag.find((part) => part.startsWith("dim "));
      const dimensions = dimPart?.replace("dim ", "");
      const imagePart = tag.find((part) => part.startsWith("image "));
      const thumbnail = imagePart?.replace("image ", "");

      return { url, mimeType, dimensions, thumbnail };
    })
    .filter((video) => video.url && video.mimeType?.startsWith("video/"));

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

  const handleVideoClick = () => {
    // Navigate to the individual post page
    navigate(`/${nevent}`);
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    // Prevent event bubbling
    e.stopPropagation();
    // Navigate to the user profile page
    navigate(`/${npub}`);
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
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
          kind: event.kind.toString(), // Support both kind 21 and 22
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

  if (videos.length === 0) return null;

  const primaryVideo = videos[0];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
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
          <div className="px-4 pb-3">
            <Badge variant="destructive" className="text-xs">
              Content Warning: {contentWarning}
            </Badge>
          </div>
        )}

        {/* Video */}
        <div className="relative aspect-[9/16] bg-black overflow-hidden cursor-pointer group">
          <video
            ref={videoRef}
            src={primaryVideo.url}
            poster={primaryVideo.thumbnail}
            className={cn(
              "w-full h-full object-cover",
              contentWarning && !isRevealed && "blur-[40px]"
            )}
            muted={isMuted}
            loop
            playsInline
            preload="metadata"
            onClick={handleVideoClick}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Video Controls Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlayPause}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              
              <div className="flex items-center space-x-2">
                {duration && (
                  <span className="text-white text-sm">
                    {Math.floor(parseInt(duration) / 60)}:{(parseInt(duration) % 60).toString().padStart(2, '0')}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMuteToggle}
                  className="text-white hover:bg-white/20"
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

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
        <div className="p-4 space-y-3">
          {/* Title */}
          {title && (
            <h3
              className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors"
              onClick={handleVideoClick}
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

          {/* Alt text for accessibility */}
          {alt && (
            <p className="text-xs text-muted-foreground italic">
              {alt}
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