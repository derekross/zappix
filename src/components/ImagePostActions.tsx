import { useState } from "react";
import {
  Copy,
  Share,
  Bookmark,
  UserPlus,
  UserMinus,
  VolumeX,
  Volume2,
  Flag,
} from "lucide-react";
import { nip19 } from "nostr-tools";
import type { NostrEvent } from "@nostrify/nostrify";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsBookmarked, useToggleBookmark } from "@/hooks/useBookmarks";
import { useIsFollowing, useToggleFollow } from "@/hooks/useFollowing";

import { useToast } from "@/hooks/useToast";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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
          title: "Zappix Image Post",
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
        title: isBookmarked.data
          ? "Removed from bookmarks"
          : "Added to bookmarks",
        description: isBookmarked.data
          ? "Post removed from your bookmarks"
          : "Post saved to your bookmarks",
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
        description: isFollowing.data
          ? "You are no longer following this user"
          : "You are now following this user",
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
      description: isMuted
        ? "You will see posts from this user again"
        : "You will no longer see posts from this user",
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

  return (
    <>
      <DropdownMenuItem onClick={handleCopyNevent}>
        <Copy className="h-4 w-4 mr-2" />
        Copy event ID
      </DropdownMenuItem>

      <DropdownMenuItem onClick={handleShare}>
        <Share className="h-4 w-4 mr-2" />
        Share post
      </DropdownMenuItem>

      {user && (
        <>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleToggleBookmark}
            disabled={toggleBookmark.isPending}
          >
            <Bookmark
              className={`h-4 w-4 mr-2 ${
                isBookmarked.data ? "fill-current text-primary" : ""
              }`}
            />
            {isBookmarked.data ? "Remove bookmark" : "Add bookmark"}
          </DropdownMenuItem>

          {!isOwnPost && (
            <>
              <DropdownMenuItem
                onClick={handleToggleFollow}
                disabled={toggleFollow.isPending}
              >
                {isFollowing.data ? (
                  <UserMinus className="h-4 w-4 mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                {isFollowing.data ? "Unfollow" : "Follow"} user
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleToggleMute}>
                {isMuted ? (
                  <Volume2 className="h-4 w-4 mr-2" />
                ) : (
                  <VolumeX className="h-4 w-4 mr-2" />
                )}
                {isMuted ? "Unmute" : "Mute"} user
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleReport}
                className="text-destructive focus:text-destructive"
              >
                <Flag className="h-4 w-4 mr-2" />
                Report post
              </DropdownMenuItem>
            </>
          )}
        </>
      )}
    </>
  );
}
