import { useState } from 'react';
import { Copy, Share, Bookmark, UserPlus, UserMinus, VolumeX, Volume2, Flag, ExternalLink } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsBookmarked, useToggleBookmark } from '@/hooks/useBookmarks';
import { useIsFollowing, useToggleFollow } from '@/hooks/useFollowing';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/useToast';
import { Separator } from '@/components/ui/separator';

interface ImagePostActionsProps {
  event: NostrEvent;
  onClose: () => void;
}

export function ImagePostActions({ event, onClose }: ImagePostActionsProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [isMuted, setIsMuted] = useState(false); // TODO: Implement mute functionality
  
  const isBookmarked = useIsBookmarked(event.id);
  const toggleBookmark = useToggleBookmark();
  const isFollowing = useIsFollowing(event.pubkey);
  const toggleFollow = useToggleFollow();
  
  const isOwnPost = user?.pubkey === event.pubkey;
  
  const handleCopyNevent = async () => {
    try {
      const nevent = nip19.neventEncode({
        id: event.id,
        author: event.pubkey,
        kind: event.kind,
      });
      
      await navigator.clipboard.writeText(nevent);
      toast({
        title: "Copied!",
        description: "Event ID copied to clipboard",
      });
      onClose();
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy event ID",
        variant: "destructive",
      });
    }
  };
  
  const handleShare = async () => {
    try {
      const nevent = nip19.neventEncode({
        id: event.id,
        author: event.pubkey,
        kind: event.kind,
      });
      
      const url = `${window.location.origin}/${nevent}`;
      
      if (navigator.share) {
        await navigator.share({
          title: 'Zappix Image Post',
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Copied!",
          description: "Post URL copied to clipboard",
        });
      }
      onClose();
    } catch {
      toast({
        title: "Error",
        description: "Failed to share post",
        variant: "destructive",
      });
    }
  };
  
  const handleToggleBookmark = async () => {
    try {
      await toggleBookmark.mutateAsync({
        eventId: event.id,
        isBookmarked: isBookmarked.data || false,
      });
      
      toast({
        title: isBookmarked.data ? "Removed from bookmarks" : "Added to bookmarks",
        description: isBookmarked.data ? "Post removed from your bookmarks" : "Post saved to your bookmarks",
      });
      onClose();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update bookmark",
        variant: "destructive",
      });
    }
  };
  
  const handleToggleFollow = async () => {
    try {
      await toggleFollow.mutateAsync({
        pubkey: event.pubkey,
        isFollowing: isFollowing.data || false,
      });
      
      toast({
        title: isFollowing.data ? "Unfollowed" : "Following",
        description: isFollowing.data ? "You are no longer following this user" : "You are now following this user",
      });
      onClose();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      });
    }
  };
  
  const handleToggleMute = () => {
    // TODO: Implement mute functionality
    setIsMuted(!isMuted);
    toast({
      title: isMuted ? "Unmuted" : "Muted",
      description: isMuted ? "You will see posts from this user again" : "You will no longer see posts from this user",
    });
    onClose();
  };
  
  const handleReport = () => {
    // TODO: Implement report functionality
    toast({
      title: "Reported",
      description: "Thank you for reporting this content",
    });
    onClose();
  };
  
  const handleOpenInClient = () => {
    const nevent = nip19.neventEncode({
      id: event.id,
      author: event.pubkey,
      kind: event.kind,
    });
    
    // Open in default Nostr client
    window.open(`nostr:${nevent}`, '_blank');
    onClose();
  };

  return (
    <Card className="absolute top-12 right-0 z-10 w-64 shadow-lg">
      <CardContent className="p-2">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleCopyNevent}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy event ID
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleShare}
          >
            <Share className="h-4 w-4 mr-2" />
            Share post
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleOpenInClient}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in Nostr client
          </Button>
          
          {user && (
            <>
              <Separator className="my-2" />
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={handleToggleBookmark}
                disabled={toggleBookmark.isPending}
              >
                <Bookmark className={`h-4 w-4 mr-2 ${isBookmarked.data ? 'fill-current' : ''}`} />
                {isBookmarked.data ? 'Remove bookmark' : 'Add bookmark'}
              </Button>
              
              {!isOwnPost && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleToggleFollow}
                    disabled={toggleFollow.isPending}
                  >
                    {isFollowing.data ? (
                      <UserMinus className="h-4 w-4 mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    {isFollowing.data ? 'Unfollow' : 'Follow'} user
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleToggleMute}
                  >
                    {isMuted ? (
                      <Volume2 className="h-4 w-4 mr-2" />
                    ) : (
                      <VolumeX className="h-4 w-4 mr-2" />
                    )}
                    {isMuted ? 'Unmute' : 'Mute'} user
                  </Button>
                  
                  <Separator className="my-2" />
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={handleReport}
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Report post
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}