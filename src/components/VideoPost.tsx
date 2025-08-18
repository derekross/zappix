import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import { useAuthor } from '@/hooks/useAuthor';
import { useReactions } from '@/hooks/useReactions';
import { useComments } from '@/hooks/useComments';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  MessageCircle, 
  Heart,
  Share2,
  Volume2,
  VolumeX,
  Play,
  Video as VideoIcon,
  MoreHorizontal
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { genUserName } from '@/lib/genUserName';
import { useIsMobile } from '@/hooks/useIsMobile';

interface VideoPostProps {
  event: NostrEvent;
  isActive: boolean;
  isMuted: boolean;
  onMuteToggle: () => void;
  onHashtagClick?: (hashtag: string) => void;
  onLocationClick?: (location: string) => void;
  onCommentClick?: (event: NostrEvent) => void;
  className?: string;
}

export function VideoPost({ 
  event, 
  isActive, 
  isMuted, 
  onMuteToggle,
  onHashtagClick,
  onLocationClick,
  onCommentClick,
  className 
}: VideoPostProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const { user } = useCurrentUser();
  const author = useAuthor(event.pubkey);
  const reactions = useReactions(event.id);
  const comments = useComments(event.id, event.pubkey);

  const metadata = author.data?.metadata;
  const displayName = metadata?.name || metadata?.display_name || genUserName(event.pubkey);
  const profileImage = metadata?.picture;

  // Parse event data
  const title = event.tags.find(([name]) => name === 'title')?.[1] || '';
  const imetaTags = event.tags.filter(([name]) => name === 'imeta');
  const hashtags = event.tags
    .filter(([name]) => name === 't')
    .map(([, tag]) => tag);
  const location = event.tags.find(([name]) => name === 'location')?.[1];
  const duration = event.tags.find(([name]) => name === 'duration')?.[1];

  // Parse video URLs from vertical video events
  let videos: Array<{ url?: string; mimeType?: string; thumbnail?: string }> = [];

  if (event.kind === 22) {
    // NIP-71 short-form video format with imeta tags
    videos = imetaTags
      .map((tag) => {
        // Parse the imeta tag which contains space-separated key-value pairs
        const tagContent = tag.slice(1).join(' ');
        
        // Extract URL
        const urlMatch = tagContent.match(/url\s+(\S+)/);
        const url = urlMatch?.[1];
        
        // Extract MIME type
        const mimeMatch = tagContent.match(/m\s+(\S+)/);
        const mimeType = mimeMatch?.[1];
        
        // Extract thumbnail (can be 'thumb' or 'image')
        const thumbMatch = tagContent.match(/thumb\s+(\S+)/);
        const imageMatch = tagContent.match(/image\s+(\S+)/);
        const thumbnail = thumbMatch?.[1] || imageMatch?.[1];

        return { url, mimeType, thumbnail };
      })
      .filter((video) => video.url && (video.mimeType?.startsWith('video/') || video.mimeType === 'application/x-mpegURL'));
  } else if (event.kind === 34236) {
    // Legacy vertical video format (kind 34236)
    videos = imetaTags
      .map((tag) => {
        // Parse the imeta tag which contains space-separated key-value pairs
        const tagContent = tag.slice(1).join(' ');
        
        // Extract URL
        const urlMatch = tagContent.match(/url\s+(\S+)/);
        const url = urlMatch?.[1];
        
        // Extract MIME type
        const mimeMatch = tagContent.match(/m\s+(\S+)/);
        const mimeType = mimeMatch?.[1];

        return { url, mimeType, thumbnail: undefined };
      })
      .filter((video) => video.url && video.mimeType?.startsWith('video/'));
  }

  const likeCount = reactions.data?.['+']?.count || 0;
  const hasLiked = reactions.data?.['+']?.hasReacted || false;
  const allComments = comments.data?.pages?.flatMap((page) => page.comments) || [];
  const uniqueCommentIds = new Set(allComments.map((c) => c.id));
  const commentCount = uniqueCommentIds.size;

  // Create nevent for linking to the post
  const nevent = nip19.neventEncode({
    id: event.id,
    relays: [],
  });

  // Create npub for linking to the user profile
  const npub = nip19.npubEncode(event.pubkey);

  // Video playback control - based on vlogstr approach
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.currentTime = 0; // Reset to beginning
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(() => {
              setIsPlaying(false);
            });
        }
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  // Additional effect to handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const handleLoadedData = () => {
        if (isActive) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setIsPlaying(true);
              })
              .catch(() => {
                setIsPlaying(false);
              });
          }
        }
      };

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleCanPlay = () => {
        if (isActive) {
          video.play().catch(() => setIsPlaying(false));
        }
      };

      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('canplay', handleCanPlay);

      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('canplay', handleCanPlay);
      };
    }
  }, [isActive]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
      }
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      toast({
        title: 'Login required',
        description: 'Please log in to like posts',
        variant: 'destructive',
      });
      return;
    }

    // Toggle like logic here - you can implement this based on your existing useReactToPost hook
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/${npub}`);
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/${nevent}`);
  };

  const handleHashtagClick = (hashtag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onHashtagClick?.(hashtag);
  };

  const handleLocationClick = (locationName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onLocationClick?.(locationName);
  };

  if (videos.length === 0) return null;

  const primaryVideo = videos[0];

  // Calculate container height based on layout
  const getContainerHeight = () => {
    if (isMobile) {
      // Mobile: subtract header (56px) and bottom nav (80px)
      return window.innerHeight - 56 - 80;
    } else {
      // Desktop: full height minus some padding/header space
      return window.innerHeight - 120; // Account for desktop layout padding
    }
  };

  // Format duration for display
  const formatDuration = (durationStr: string) => {
    const duration = parseFloat(durationStr);
    if (isNaN(duration)) return null;
    
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={cn('relative w-full bg-black flex items-center justify-center', className)}
      style={{ height: `${getContainerHeight()}px` }}
    >
      {primaryVideo.url ? (
        <video
          ref={videoRef}
          src={primaryVideo.url}
          poster={primaryVideo.thumbnail}
          loop
          muted={isMuted}
          playsInline
          autoPlay={isActive}
          preload="metadata"
          className="max-w-full max-h-full object-contain cursor-pointer"
          onClick={togglePlayPause}
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-white">
          <VideoIcon className="h-16 w-16 mb-4" />
          <p>Video unavailable</p>
        </div>
      )}

      {/* Play/Pause overlay */}
      {!isPlaying && primaryVideo.url && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
          onClick={togglePlayPause}
        >
          <div className="rounded-full bg-white/20 p-6 backdrop-blur-sm">
            <Play className="h-12 w-12 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Duration indicator */}
      {duration && (
        <div className="absolute top-4 right-4 bg-black/80 text-white px-2 py-1 rounded text-sm">
          {formatDuration(duration)}
        </div>
      )}

      {/* Video info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-20 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-end justify-between">
          <div className="flex-1 mr-4">
            <Link to={`/${npub}`} className="flex items-center mb-3" onClick={handleProfileClick}>
              <Avatar className="h-10 w-10 mr-3 ring-2 ring-white">
                {profileImage && <AvatarImage src={profileImage} alt={displayName} />}
                <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-white font-semibold">{displayName}</span>
            </Link>
            
            {title && (
              <h3 
                className="text-white font-semibold text-lg mb-2 cursor-pointer hover:text-gray-200"
                onClick={handleTitleClick}
              >
                {title}
              </h3>
            )}
            
            {event.content && (
              <p className="text-white/90 text-sm line-clamp-2 mb-2">{event.content}</p>
            )}

            {/* Hashtags */}
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {hashtags.slice(0, 3).map((hashtag) => (
                  <button
                    key={hashtag}
                    className="text-blue-300 text-sm hover:text-blue-200 transition-colors"
                    onClick={(e) => handleHashtagClick(hashtag, e)}
                  >
                    #{hashtag}
                  </button>
                ))}
                {hashtags.length > 3 && (
                  <span className="text-white/60 text-sm">+{hashtags.length - 3}</span>
                )}
              </div>
            )}

            {/* Location */}
            {location && (
              <button
                className="text-gray-300 text-sm hover:text-gray-200 transition-colors mb-2 block"
                onClick={(e) => handleLocationClick(location, e)}
              >
                📍 {location}
              </button>
            )}

            <p className="text-white/60 text-xs">
              {formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true })}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center space-y-4">
            <Button
              variant="ghost"
              size="icon"
              className={`hover:bg-white/20 ${hasLiked ? 'text-red-500' : 'text-white'}`}
              onClick={handleLike}
            >
              <Heart className={`h-6 w-6 ${hasLiked ? 'fill-current' : ''}`} />
            </Button>
            {likeCount > 0 && (
              <span className="text-white text-xs font-semibold">{likeCount}</span>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                onCommentClick?.(event);
              }}
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
            {commentCount > 0 && (
              <span className="text-white text-xs font-semibold">{commentCount}</span>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                if (navigator.share && primaryVideo.url) {
                  navigator.share({
                    title: title || 'Check out this video on Zappix',
                    url: window.location.origin + `/${nevent}`,
                  });
                } else {
                  // Fallback: copy to clipboard
                  navigator.clipboard.writeText(window.location.origin + `/${nevent}`);
                  toast({
                    title: 'Link copied',
                    description: 'Video link copied to clipboard',
                  });
                }
              }}
            >
              <Share2 className="h-6 w-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={onMuteToggle}
            >
              {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setShowActions(!showActions)}
            >
              <MoreHorizontal className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}