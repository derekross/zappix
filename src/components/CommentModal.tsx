import type { NostrEvent } from '@nostrify/nostrify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Comment } from '@/components/Comment';
import { CommentForm } from '@/components/CommentForm';
import { useComments } from '@/hooks/useComments';
import { MessageCircle } from 'lucide-react';

interface CommentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: NostrEvent | null;
}

export function CommentModal({ open, onOpenChange, event }: CommentModalProps) {
  const comments = useComments(event?.id || '', event?.pubkey || '');

  // Get all comments from all pages and deduplicate
  const allComments = comments.data?.pages?.flatMap((page) => page.comments) || [];
  const uniqueComments = allComments.filter(
    (comment, index, self) => index === self.findIndex((c) => c.id === comment.id)
  );

  const commentCount = uniqueComments.length;
  const title = event?.tags.find(([name]) => name === 'title')?.[1] || 'Video';

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[80vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-left flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Comments
            {commentCount > 0 && (
              <span className="text-sm text-muted-foreground">({commentCount})</span>
            )}
          </DialogTitle>
          {title && (
            <p className="text-sm text-muted-foreground text-left">{title}</p>
          )}
        </DialogHeader>

        <Separator />

        <div className="flex flex-col flex-1 min-h-0">
          <ScrollArea className="flex-1 px-4">
            {comments.isLoading && !comments.data ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : uniqueComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground text-sm">
                  No comments yet. Be the first to comment!
                </p>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {uniqueComments.map((comment) => (
                  <Comment
                    key={comment.id}
                    event={comment}
                    parentEventId={event.id}
                    parentEventPubkey={event.pubkey}
                    parentEventKind={event.kind}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          <Separator />

          <div className="p-4 pt-3">
            <CommentForm
              eventId={event.id}
              eventPubkey={event.pubkey}
              eventKind={event.kind}
              onCommentPosted={() => {
                // Refetch comments after posting
                comments.refetch();
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}