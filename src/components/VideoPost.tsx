import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import { useAuthor } from '@/hooks/useAuthor';
import { useReactions, useReactToPost, useRemoveReaction } from '@/hooks/useReactions';
import { useComments } from '@/hooks/useComments';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { ZapButton } from '@/components/ZapButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { VideoPostActions } from '@/components/VideoPostActions';
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
  const { mutate: reactToPost } = useReactToPost();
  const { mutate: removeReaction } = useRemoveReaction();

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

  // Check for simple URL tags as fallback
  const urlTags = event.tags.filter(([name]) => name === 'url');




  if (event.kind === 22) {
    // NIP-71 short-form video format with imeta tags
    videos = imetaTags
      .map((tag) => {
        let url: string | undefined;
        let mimeType: string | undefined;
        let thumbnail: string | undefined;

        // The new format should be a single string with space-separated key-value pairs
        // But handle backward compatibility with incorrect format as well

        // First try the correct NIP-94 format: space-separated key-value pairs in single string
        if (tag.length === 2) {
          const tagContent = tag[1]; // Just the second element which should be the full content string

          const urlMatch = tagContent.match(/url\s+(\S+)/);
          url = urlMatch?.[1];

          const mimeMatch = tagContent.match(/\bm\s+([^\s]+)/);
          mimeType = mimeMatch?.[1];

          const thumbMatch = tagContent.match(/thumb\s+(\S+)/);
          const imageMatch = tagContent.match(/image\s+(\S+)/);
          thumbnail = thumbMatch?.[1] || imageMatch?.[1];
        }

        // Handle the current incorrect format that's being generated
        // Format: ['imeta', 'url <URL>', 'm <MIME>', 'dim ...', 'alt ...', ...]
        if ((!url || !mimeType) && tag.length > 2) {
          // Look for URL element
          const urlElement = tag.find(element => typeof element === 'string' && element.startsWith('url '));
          if (urlElement && !url) {
            url = urlElement.replace('url ', '');
          }

          // Look for MIME type element
          const mimeElement = tag.find(element => typeof element === 'string' && element.startsWith('m '));
          if (mimeElement && !mimeType) {
            const extractedType = mimeElement.replace('m ', '');
            // Only use if it looks like a valid MIME type (contains '/')
            if (extractedType.includes('/')) {
              mimeType = extractedType;
            }
          }

          // Look for thumbnail elements
          const thumbElement = tag.find(element => typeof element === 'string' && element.startsWith('thumb '));
          const imageElement = tag.find(element => typeof element === 'string' && element.startsWith('image '));
          if (thumbElement && !thumbnail) {
            thumbnail = thumbElement.replace('thumb ', '');
          } else if (imageElement && !thumbnail) {
            thumbnail = imageElement.replace('image ', '');
          }
        }

        // Final fallback: join all elements and parse (for any edge cases)
        if (!url || !mimeType) {
          const tagContent = tag.slice(1).join(' ');

          if (!url) {
            const urlMatch = tagContent.match(/url\s+(\S+)/);
            url = urlMatch?.[1];
          }

          if (!mimeType) {
            const mimeMatch = tagContent.match(/\bm\s+([^\s]+)/);
            mimeType = mimeMatch?.[1];
          }

          if (!thumbnail) {
            const thumbMatch = tagContent.match(/thumb\s+(\S+)/);
            const imageMatch = tagContent.match(/image\s+(\S+)/);
            thumbnail = thumbMatch?.[1] || imageMatch?.[1];
          }
        }

        return { url, mimeType, thumbnail };
      })
      .filter((video) => video.url && (video.mimeType?.startsWith('video/') || video.mimeType === 'application/x-mpegURL'));
  } else if (event.kind === 34236) {
    // Legacy vertical video format (kind 34236)
    videos = imetaTags
      .map((tag) => {
        let url: string | undefined;
        let mimeType: string | undefined;
        let thumbnail: string | undefined;

        // First try the correct NIP-94 format: space-separated key-value pairs in single string
        if (tag.length === 2) {
          const tagContent = tag[1]; // Just the second element which should be the full content string

          const urlMatch = tagContent.match(/url\s+(\S+)/);
          url = urlMatch?.[1];

          const mimeMatch = tagContent.match(/\bm\s+([^\s]+)/);
          mimeType = mimeMatch?.[1];

          const thumbMatch = tagContent.match(/thumb\s+(\S+)/);
          const imageMatch = tagContent.match(/image\s+(\S+)/);
          thumbnail = thumbMatch?.[1] || imageMatch?.[1];
        }

        // Handle the current incorrect format that's being generated
        // Format: ['imeta', 'url <URL>', 'm <MIME>', 'dim ...', 'alt ...', ...]
        if ((!url || !mimeType) && tag.length > 2) {
          // Look for URL element
          const urlElement = tag.find(element => typeof element === 'string' && element.startsWith('url '));
          if (urlElement && !url) {
            url = urlElement.replace('url ', '');
          }

          // Look for MIME type element
          const mimeElement = tag.find(element => typeof element === 'string' && element.startsWith('m '));
          if (mimeElement && !mimeType) {
            const extractedType = mimeElement.replace('m ', '');
            // Only use if it looks like a valid MIME type (contains '/')
            if (extractedType.includes('/')) {
              mimeType = extractedType;
            }
          }

          // Look for thumbnail elements
          const thumbElement = tag.find(element => typeof element === 'string' && element.startsWith('thumb '));
          const imageElement = tag.find(element => typeof element === 'string' && element.startsWith('image '));
          if (thumbElement && !thumbnail) {
            thumbnail = thumbElement.replace('thumb ', '');
          } else if (imageElement && !thumbnail) {
            thumbnail = imageElement.replace('image ', '');
          }
        }

        // Final fallback: join all elements and parse (for any edge cases)
        if (!url || !mimeType) {
          const tagContent = tag.slice(1).join(' ');

          if (!url) {
            const urlMatch = tagContent.match(/url\s+(\S+)/);
            url = urlMatch?.[1];
          }

          if (!mimeType) {
            const mimeMatch = tagContent.match(/\bm\s+([^\s]+)/);
            mimeType = mimeMatch?.[1];
          }

          if (!thumbnail) {
            const thumbMatch = tagContent.match(/thumb\s+(\S+)/);
            const imageMatch = tagContent.match(/image\s+(\S+)/);
            thumbnail = thumbMatch?.[1] || imageMatch?.[1];
          }
        }

        return { url, mimeType, thumbnail };
      })
      .filter((video) => video.url && video.mimeType?.startsWith('video/'));
  }

  // Fallback: If no videos found from imeta tags, try to parse from direct URL tags
  if (videos.length === 0 && urlTags.length > 0) {
    videos = urlTags
      .map(([, url]) => {
        // Try to determine MIME type from URL extension
        let mimeType = 'video/mp4'; // default
        if (url.toLowerCase().endsWith('.webm')) {
          mimeType = 'video/webm';
        } else if (url.toLowerCase().endsWith('.mov')) {
          mimeType = 'video/quicktime';
        } else if (url.toLowerCase().endsWith('.avi')) {
          mimeType = 'video/x-msvideo';
        }

        return { url, mimeType, thumbnail: undefined };
      })
      .filter((video) => video.url && (video.url.includes('video') || video.url.match(/\.(mp4|webm|mov|avi)$/i)));
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

  // Video playback control - enhanced with better state management
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        // Reset to beginning and attempt to play
        videoRef.current.currentTime = 0;
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

      const handlePlay = () => {
        setIsPlaying(true);
      };

      const handlePause = () => {
        setIsPlaying(false);
      };

      const handleCanPlay = () => {
        if (isActive) {
          video.play().catch(() => {
            setIsPlaying(false);
          });
        }
      };

      const handleError = () => {
        // Video error handling (logging removed)
      };

      const handleLoadStart = () => {
        // Video load start (logging removed)
      };

      const handleLoadedMetadata = () => {
        // Video metadata loaded (logging removed)
      };

      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);
      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);

      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [isActive]);

  // Effect to sync muted state with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlayPause = (e?: React.MouseEvent) => {
    // Stop propagation if this is from an overlay click
    if (e) {
      e.stopPropagation();
    }

    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        // Set playing state only after successful play
        videoRef.current.play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            setIsPlaying(false);
          });
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

    try {
      if (hasLiked) {
        // Unlike the post
        removeReaction({
          eventId: event.id,
          reaction: '+',
        });
      } else {
        // Like the post
        reactToPost({
          eventId: event.id,
          authorPubkey: event.pubkey,
          reaction: '+',
          kind: event.kind.toString(),
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update reaction',
        variant: 'destructive',
      });
    }
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


  // Helper function to get corrected MIME type based on URL extension
  const getCorrectedVideo = (video: typeof videos[0] | undefined) => {
    if (!video || !video.url || !video.mimeType) return video;

    const url = video.url.toLowerCase();
    let correctedMimeType = video.mimeType;

    // Check URL extension and override MIME type if mismatched
    if (url.endsWith('.webm') && !correctedMimeType.includes('webm')) {
      correctedMimeType = 'video/webm';
    } else if (url.endsWith('.mp4') && !correctedMimeType.includes('mp4')) {
      correctedMimeType = 'video/mp4';
    } else if (url.endsWith('.mov') && !correctedMimeType.includes('quicktime')) {
      correctedMimeType = 'video/quicktime';
    }

    return {
      ...video,
      mimeType: correctedMimeType
    };
  };

  const primaryVideo = videos.length > 0 ? videos[0] : undefined;
  const correctedVideo = getCorrectedVideo(primaryVideo);

  // Check codec support for WebM files
  useEffect(() => {
    if (correctedVideo?.url && correctedVideo.url.endsWith('.webm')) {
      const video = document.createElement('video');
      const supportedFormats = [
        'video/webm; codecs="vp9"',
        'video/webm; codecs="vp8"',
        'video/webm; codecs="vp9,vorbis"',
        'video/webm; codecs="vp8,vorbis"',
        'video/webm; codecs="vp9,opus"',
        'video/webm; codecs="vp8,opus"',
        'video/webm',
      ];

      // Check codec support (logging removed)
      supportedFormats.forEach(format => {
        video.canPlayType(format);
      });
    }
  }, [correctedVideo?.url]);


    

  if (videos.length === 0) {

    return null;
  }

  if (!correctedVideo) {

    return null;
  }

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
      {correctedVideo.url ? (
        <video
          ref={videoRef}
          src={correctedVideo.url}
          poster={correctedVideo.thumbnail}
          loop
          muted={isMuted}
          playsInline
          autoPlay={isActive}
          preload="metadata"
          className="max-w-full max-h-full object-contain cursor-pointer"
          onClick={(e) => {
            e.preventDefault(); // Prevent default behavior
            togglePlayPause();
          }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-white">
          <VideoIcon className="h-16 w-16 mb-4" />
          <p>Video unavailable</p>
        </div>
      )}

      {/* Play/Pause overlay */}
      {!isPlaying && correctedVideo.url && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation(); // Prevent event from bubbling to video element
            togglePlayPause();
          }}
        >
          <div className="rounded-full bg-white/90 hover:bg-white transition-all duration-200 p-6 shadow-lg">
            <Play className="h-12 w-12 text-black fill-black" />
          </div>
        </div>
      )}

      {/* Pause indicator overlay (fades in when video is playing) */}
      {isPlaying && correctedVideo.url && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300"
        >
          <div className="rounded-full bg-black/50 p-4 opacity-70">
            <Play className="h-8 w-8 text-white fill-white rotate-90" />
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
      <div
        className="absolute bottom-0 left-0 right-0 p-4 pb-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"
      >
        <div className="flex-1 mr-4 pointer-events-auto">
          <Link to={`/${npub}`} className="flex items-center mb-3 pointer-events-auto" onClick={handleProfileClick}>
            <Avatar className="h-10 w-10 mr-3 ring-2 ring-white">
              {profileImage && <AvatarImage src={profileImage} alt={displayName} />}
              <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-white font-semibold">{displayName}</span>
          </Link>

          {title && (
            <h3
              className="text-white font-semibold text-lg mb-2 cursor-pointer hover:text-gray-200 pointer-events-auto"
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
                  className="text-blue-300 text-sm hover:text-blue-200 transition-colors pointer-events-auto"
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
              className="text-gray-300 text-sm hover:text-gray-200 transition-colors mb-2 block pointer-events-auto"
              onClick={(e) => handleLocationClick(location, e)}
            >
              📍 {location}
            </button>
          )}

          <p className="text-white/60 text-xs">
            {formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Action buttons - positioned on the right side */}
      <div className="absolute right-4 bottom-20 top-1/2 -translate-y-1/2 flex flex-col items-center space-y-4 pointer-events-auto">
            <Button
              variant="ghost"
              size="icon"
              className={`hover:bg-white/20 ${hasLiked ? 'text-red-500' : 'text-white'} pointer-events-auto`}
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
              className="text-white hover:bg-white/20 pointer-events-auto"
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

            <div className="hover:bg-white/20 rounded-md p-2 transition-colors pointer-events-auto">
              <ZapButton
                target={event}
                className="text-white text-xs"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                if (navigator.share && correctedVideo.url) {
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

            <DropdownMenu open={showActions} onOpenChange={setShowActions}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 pointer-events-auto"
                >
                  <MoreHorizontal className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <VideoPostActions
                  event={event}
                  onClose={() => setShowActions(false)}
                />
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </div>
  );
}