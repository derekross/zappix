import { useState } from "react";
import { Send } from "lucide-react";
import { useCreateComment } from "@/hooks/useComments";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { genUserName } from "@/lib/genUserName";
import { useToast } from "@/hooks/useToast";
import { LoginArea } from "@/components/auth/LoginArea";

interface CommentFormProps {
  eventId: string;
  eventPubkey: string;
  eventKind?: number;
  parentEventId?: string;
  parentEventPubkey?: string;
  placeholder?: string;
  onCommentPosted?: () => void;
}

export function CommentForm({ 
  eventId,
  eventPubkey,
  eventKind,
  parentEventId,
  parentEventPubkey,
  placeholder = "Add a comment...",
  onCommentPosted
}: CommentFormProps) {
  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const { user } = useCurrentUser();
  const createComment = useCreateComment();
  const { toast } = useToast();
  
  // Get current user's profile for avatar
  const currentUserProfile = useAuthor(user?.pubkey);
  const currentUserMetadata = currentUserProfile.data?.metadata;
  const currentUserDisplayName = currentUserMetadata?.name || currentUserMetadata?.display_name || (user ? genUserName(user.pubkey) : '');
  const currentUserProfileImage = currentUserMetadata?.picture;

  const maxLength = 500;
  const isOverLimit = content.length > maxLength;

  const handleSubmit = async () => {
    if (!content.trim() || !user || isOverLimit) return;

    try {
      await createComment.mutateAsync({
        content: content.trim(),
        rootEventId: eventId,
        rootAuthorPubkey: eventPubkey,
        rootEventKind: eventKind,
        parentEventId,
        parentAuthorPubkey: parentEventPubkey,
      });

      setContent("");
      setIsFocused(false);
      
      toast({
        title: "Comment posted!",
        description: "Your comment has been published",
      });

      // Call the callback if provided
      onCommentPosted?.();
    } catch (error) {
      console.error('Comment submission failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to post comment';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Show login prompt if user is not logged in
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-4 space-y-4 border border-dashed border-muted rounded-lg bg-muted/20">
        <p className="text-sm text-muted-foreground text-center">
          Log in to join the conversation
        </p>
        <LoginArea className="max-w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex space-x-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={currentUserProfileImage} alt={currentUserDisplayName} />
          <AvatarFallback className="text-xs">{currentUserDisplayName[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <Textarea
            placeholder={placeholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => !content.trim() && setIsFocused(false)}
            onKeyDown={handleKeyDown}
            className="min-h-[40px] text-sm resize-none border-muted focus:border-primary transition-colors"
            disabled={createComment.isPending}
          />
          
          {(isFocused || content.trim()) && (
            <div className="flex items-center justify-between">
              <span className={`text-xs transition-colors ${
                isOverLimit ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {content.length}/{maxLength}
              </span>
              
              <div className="flex space-x-2">
                {content.trim() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setContent("");
                      setIsFocused(false);
                    }}
                    disabled={createComment.isPending}
                  >
                    Cancel
                  </Button>
                )}
                
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!content.trim() || createComment.isPending || isOverLimit}
                >
                  {createComment.isPending ? (
                    <div className="h-3 w-3 mr-1 animate-spin rounded-full border-b border-current" />
                  ) : (
                    <Send className="h-3 w-3 mr-1" />
                  )}
                  Comment
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {(isFocused || content.trim()) && (
        <p className="text-xs text-muted-foreground ml-11">
          Tip: Use Cmd+Enter (Mac) or Ctrl+Enter (PC) to post quickly
        </p>
      )}
    </div>
  );
}