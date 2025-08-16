import { useState, useEffect } from "react";
import { Send, Heart, MessageCircle, Loader2 } from "lucide-react";
import { useInView } from "react-intersection-observer";
import {
  useReactions,
  useReactToPost,
  useRemoveReaction,
} from "@/hooks/useReactions";
import { useZaps } from "@/hooks/useZaps";
import { ZapButton } from "./ZapButton";
import type { NostrEvent } from "@nostrify/nostrify";
import { useComments, useCommentReplies, useCreateComment } from "@/hooks/useComments";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { genUserName } from "@/lib/genUserName";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";

interface CommentSectionProps {
  eventId: string;
  authorPubkey: string;
}

interface CommentProps {
  comment: NostrEvent;
  rootEventId: string;
  rootAuthorPubkey: string;
}

function Comment({ comment, rootEventId, rootAuthorPubkey }: CommentProps) {
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
  const replies = useCommentReplies(comment.id, rootEventId);

  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(comment.pubkey);
  const profileImage = metadata?.picture;

  const likeCount = reactions.data?.["+"]?.count || 0;
  const hasLiked = reactions.data?.["+"]?.hasReacted || false;
  const zapTotal = zaps.data?.totalSats || 0;

  const handleReply = async () => {
    if (!replyContent.trim() || !user) return;

    try {
      await createComment.mutateAsync({
        content: replyContent.trim(),
        rootEventId,
        rootAuthorPubkey,
        parentEventId: comment.id,
        parentAuthorPubkey: comment.pubkey,
      });

      setReplyContent("");
      setShowReplyForm(false);
      toast({
        title: "Reply posted!",
        description: "Your reply has been published",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to post reply",
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

  const replyList = replies.data ?? [];
  console.log('Comment', comment.id, comment.tags);

  return (
    <div className="space-y-2">
      <div className="flex space-x-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profileImage} alt={displayName} />
          <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm">{displayName}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(comment.created_at * 1000).toLocaleString()}
            </span>
          </div>

          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>

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
              {likeCount}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              <MessageCircle className="h-3 w-3" />
            </Button>

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
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="min-h-[60px] text-sm"
          />
          <div className="flex justify-end space-x-2">
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
              <Send className="h-3 w-3 mr-1" />
              Reply
            </Button>
          </div>
        </div>
      )}

      {replyList.length > 0 && (
        <div className="ml-6 pl-4 border-l border-muted space-y-4">
          {replyList.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              rootEventId={rootEventId}
              rootAuthorPubkey={rootAuthorPubkey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentSection({ eventId, authorPubkey }: CommentSectionProps) {
  const [newComment, setNewComment] = useState("");
  const isMobile = useIsMobile();

  const comments = useComments(eventId, authorPubkey);
  const createComment = useCreateComment();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const { ref: loadMoreRef, inView } = useInView({ threshold: 0, rootMargin: "100px" });

  useEffect(() => {
    if (inView && comments.hasNextPage && !comments.isFetchingNextPage) {
      comments.fetchNextPage();
    }
  }, [inView, comments]);

  const allComments = comments.data?.pages?.flatMap((page) => page.comments) || [];
  const uniqueComments = allComments.filter((comment, index, array) =>
    array.findIndex((c) => c.id === comment.id) === index
  );

  // Only show comments as top-level if the last 'e' tag is for the root event (NIP-10 threading)
  const topLevelComments = uniqueComments.filter(comment => {
    const eTags = comment.tags.filter(tag => tag[0] === 'e');
    return eTags.length > 0 && eTags[eTags.length - 1][1] === eventId;
  });
  const sortedComments = topLevelComments.sort((a, b) => a.created_at - b.created_at);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    try {
      await createComment.mutateAsync({
        content: newComment.trim(),
        rootEventId: eventId,
        rootAuthorPubkey: authorPubkey,
      });

      setNewComment("");
      await comments.refetch();

      toast({
        title: "Comment posted!",
        description: "Your comment has been published",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="border-t bg-muted/30">
      <div className={cn("p-4 space-y-4", isMobile && "px-2")}>        
        {user ? (
          <div className="space-y-3">
            <Textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || createComment.isPending}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                Post Comment
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Please log in to comment
          </p>
        )}

        {comments.data && sortedComments.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">
                Comments ({sortedComments.length})
              </h4>

              {sortedComments.map((comment) => {
                console.log('Top-level candidate', comment.id, comment.tags);
                return (
                  <Comment
                    key={comment.id}
                    comment={comment}
                    rootEventId={eventId}
                    rootAuthorPubkey={authorPubkey}
                  />
                );
              })}

              {comments.hasNextPage && (
                <div ref={loadMoreRef} className="flex justify-center py-4">
                  {comments.isFetchingNextPage ? (
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading more comments...</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => comments.fetchNextPage()}
                      disabled={!comments.hasNextPage}
                    >
                      Load More Comments
                    </Button>
                  )}
                </div>
              )}

              {!comments.hasNextPage && sortedComments.length > 10 && (
                <div className="text-center py-2">
                  <p className="text-muted-foreground text-xs">
                    All comments loaded
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {comments.isLoading && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Loading comments...</p>
          </div>
        )}
      </div>
    </div>
  );
}
