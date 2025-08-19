import { useState } from "react";
import { Send, Heart, MessageCircle } from "lucide-react";
import {
  useReactions,
  useReactToPost,
  useRemoveReaction,
} from "@/hooks/useReactions";
import { useZaps } from "@/hooks/useZaps";
import { ZapButton } from "./ZapButton";
import type { NostrEvent } from "@nostrify/nostrify";
import { useCommentReplies, useCreateComment } from "@/hooks/useComments";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { genUserName } from "@/lib/genUserName";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';

interface CommentProps {
  event: NostrEvent;
  parentEventId: string;
  parentEventPubkey: string;
  parentEventKind?: number;
  level?: number;
}

export function Comment({ 
  event: comment, 
  parentEventId: rootEventId, 
  parentEventPubkey: rootAuthorPubkey,
  parentEventKind,
  level = 0
}: CommentProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");

  const author = useAuthor(comment.pubkey);
  const reactions = useReactions(comment.id);
  const zaps = useZaps(comment.id);
  const createComment = useCreateComment();
  const reactToPost = useReactToPost();
  const removeReaction = useRemoveReaction();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const replies = useCommentReplies(comment.id);

  const metadata = author.data?.metadata;
  const displayName = metadata?.name || metadata?.display_name || genUserName(comment.pubkey);
  const profileImage = metadata?.picture;

  const likeCount = reactions.data?.["+"]?.count || 0;
  const hasLiked = reactions.data?.["+"]?.hasReacted || false;
  const zapTotal = zaps.data?.totalSats || 0;

  // Limit nesting depth to prevent UI issues
  const maxNestingLevel = 3;
  const canReply = level < maxNestingLevel;

  const handleReply = async () => {
    if (!replyContent.trim() || !user) return;

    try {
      await createComment.mutateAsync({
        content: replyContent.trim(),
        rootEventId,
        rootAuthorPubkey,
        rootEventKind: parentEventKind,
        parentEventId: comment.id,
        parentAuthorPubkey: comment.pubkey,
      });

      setReplyContent("");
      setShowReplyForm(false);
      toast({
        title: "Reply posted!",
        description: "Your reply has been published",
      });
    } catch (error) {
      console.error('Reply submission failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to post reply';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to like comments",
        variant: "destructive",
      });
      return;
    }

    try {
      if (hasLiked) {
        await removeReaction.mutateAsync({
          eventId: comment.id,
          reaction: "+",
        });
      } else {
        await reactToPost.mutateAsync({
          eventId: comment.id,
          authorPubkey: comment.pubkey,
          reaction: "+",
          kind: "1111",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: hasLiked ? "Failed to remove like" : "Failed to like comment",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex space-x-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={profileImage} alt={displayName} />
          <AvatarFallback className="text-xs">{displayName[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm truncate">{displayName}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatDistanceToNow(new Date(comment.created_at * 1000), { addSuffix: true })}
            </span>
          </div>

          <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>

          <div className="flex items-center space-x-4 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleLike}
              disabled={reactToPost.isPending || removeReaction.isPending}
            >
              <Heart
                className={cn(
                  "h-3 w-3 mr-1 transition-colors",
                  hasLiked ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-500"
                )}
              />
              {likeCount > 0 && <span>{likeCount}</span>}
            </Button>

            {canReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}

            <ZapButton
              eventId={comment.id}
              authorPubkey={comment.pubkey}
              zapTotal={zapTotal}
              size="sm"
            />
          </div>
        </div>
      </div>

      {showReplyForm && user && (
        <div className="ml-11 space-y-2">
          <Textarea
            placeholder={`Reply to ${displayName}...`}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="min-h-[60px] text-sm resize-none"
            maxLength={500}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {replyContent.length}/500
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyContent("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleReply}
                disabled={!replyContent.trim() || createComment.isPending}
              >
                {createComment.isPending ? (
                  <div className="h-3 w-3 mr-1 animate-spin rounded-full border-b border-current" />
                ) : (
                  <Send className="h-3 w-3 mr-1" />
                )}
                Reply
              </Button>
            </div>
          </div>
        </div>
      )}

      {replies.data && replies.data.length > 0 && level < maxNestingLevel && (
        <div className="ml-6 pl-4 border-l border-muted space-y-3">
          {replies.data.map((reply) => (
            <Comment
              key={reply.id}
              event={reply}
              parentEventId={rootEventId}
              parentEventPubkey={rootAuthorPubkey}
              parentEventKind={parentEventKind}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}