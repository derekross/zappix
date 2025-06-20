import { useState, useEffect } from "react";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  MapPin,
  Hash,
  Eye,
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { genUserName } from "@/lib/genUserName";
import { ImagePostActions } from "./ImagePostActions";
import { CommentSection } from "./CommentSection";
import { ZapButton } from "./ZapButton";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import * as nip19 from "nostr-tools/nip19";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ImagePostProps {
  event: NostrEvent;
  className?: string;
  onHashtagClick?: (hashtag: string) => void;
  onLocationClick?: (location: string) => void;
}

export function ImagePost({
  event,
  className,
  onHashtagClick,
  onLocationClick,
}: ImagePostProps) {
  const [showComments, setShowComments] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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

  // Parse image URLs from imeta tags
  const images = imetaTags
    .map((tag) => {
      const urlPart = tag.find((part) => part.startsWith("url "));
      const url = urlPart?.replace("url ", "");
      const altPart = tag.find((part) => part.startsWith("alt "));
      const alt = altPart?.replace("alt ", "");
      const dimPart = tag.find((part) => part.startsWith("dim "));
      const dimensions = dimPart?.replace("dim ", "");

      // Parse dimensions to calculate aspect ratio
      let aspectRatio = 4/3; // Default fallback
      let width = 0;
      let height = 0;
      
      if (dimensions) {
        const [w, h] = dimensions.split('x').map(Number);
        if (w && h && w > 0 && h > 0) {
          width = w;
          height = h;
          aspectRatio = w / h;
        }
      }

      return { url, alt, dimensions, aspectRatio, width, height };
    })
    .filter((img) => img.url);

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

  // Helper function to get container styles based on aspect ratio
  const getImageContainerStyle = (aspectRatio: number) => {
    // For very wide images (panoramic), limit height
    if (aspectRatio > 2.5) {
      return "h-[300px] w-full";
    }
    // For very tall images (portrait), limit height
    if (aspectRatio < 0.6) {
      return "h-[600px] w-full";
    }
    // For normal aspect ratios, use the actual ratio with a max height
    return `max-h-[500px] w-full`;
  };

  // Helper function to get aspect ratio class
  const getAspectRatioClass = (aspectRatio: number) => {
    // For very wide or very tall images, don't use aspect ratio (use height limits instead)
    if (aspectRatio > 2.5 || aspectRatio < 0.6) {
      return "";
    }
    
    // For common aspect ratios, use Tailwind classes
    if (Math.abs(aspectRatio - 1) < 0.1) return "aspect-square";
    if (Math.abs(aspectRatio - 4/3) < 0.1) return "aspect-[4/3]";
    if (Math.abs(aspectRatio - 3/2) < 0.1) return "aspect-[3/2]";
    if (Math.abs(aspectRatio - 16/9) < 0.1) return "aspect-video";
    if (Math.abs(aspectRatio - 3/4) < 0.1) return "aspect-[3/4]";
    if (Math.abs(aspectRatio - 2/3) < 0.1) return "aspect-[2/3]";
    
    // For other ratios, calculate a custom aspect ratio
    const ratio = Math.round(aspectRatio * 100) / 100;
    return `aspect-[${Math.round(ratio * 100)}/100]`;
  };

  // Handle carousel slide changes
  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };

    carouselApi.on("select", onSelect);
    onSelect(); // Set initial slide

    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  const handleImageClick = () => {
    // Navigate to the individual post page
    navigate(`/${nevent}`);
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    // Prevent event bubbling
    e.stopPropagation();
    // Navigate to the user profile page
    navigate(`/${npub}`);
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
          kind: "20",
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

  if (images.length === 0) return null;

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

        {/* Images */}
        {images.length === 1 ? (
          // Single image - display with dynamic aspect ratio
          <div className="relative">
            <div
              className={cn(
                "relative overflow-hidden cursor-pointer group",
                getAspectRatioClass(images[0].aspectRatio),
                getImageContainerStyle(images[0].aspectRatio)
              )}
              onClick={handleImageClick}
            >
              <img
                src={images[0].url}
                alt={images[0].alt || title}
                className={cn(
                  "w-full h-full object-cover group-hover:scale-105 transition-all duration-200",
                  contentWarning && !isRevealed && "blur-[40px]"
                )}
                loading="lazy"
              />
              {/* Subtle overlay on hover to indicate clickability */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
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
        ) : (
          // Multiple images - use carousel
          <div className="relative">
            <Carousel 
              className="w-full" 
              setApi={setCarouselApi}
              opts={{
                align: "start",
                loop: true,
              }}
            >
              <CarouselContent>
                {images.map((image, index) => (
                  <CarouselItem key={index}>
                    <div
                      className={cn(
                        "relative overflow-hidden cursor-pointer group",
                        getAspectRatioClass(image.aspectRatio),
                        getImageContainerStyle(image.aspectRatio)
                      )}
                      onClick={handleImageClick}
                    >
                      <img
                        src={image.url}
                        alt={image.alt || title}
                        className={cn(
                          "w-full h-full object-cover group-hover:scale-105 transition-all duration-200",
                          contentWarning && !isRevealed && "blur-[40px]"
                        )}
                        loading="lazy"
                      />
                      {/* Subtle overlay on hover to indicate clickability */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              
              {/* Navigation buttons - only show if there are multiple images */}
              {images.length > 1 && (
                <>
                  <CarouselPrevious className="left-2 bg-black/50 border-white/20 text-white hover:bg-black/70" />
                  <CarouselNext className="right-2 bg-black/50 border-white/20 text-white hover:bg-black/70" />
                </>
              )}

              {/* Image counter and dots indicator */}
              {images.length > 1 && (
                <>
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                    {currentSlide + 1} / {images.length}
                  </div>
                  
                  {/* Dots indicator */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all duration-200",
                          index === currentSlide 
                            ? "bg-white" 
                            : "bg-white/50 hover:bg-white/75"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          carouselApi?.scrollTo(index);
                        }}
                        aria-label={`Go to slide ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </Carousel>

            {/* Reveal overlay for content warnings */}
            {contentWarning && !isRevealed && (
              <div
                className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer z-10"
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
        )}

        {/* Post Content */}
        <div className={cn("p-4 space-y-3", isMobile && "px-2")}>
          {/* Title */}
          {title && (
            <h3
              className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors"
              onClick={handleImageClick}
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
