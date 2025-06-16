import { useState } from "react";
import { Zap } from "lucide-react";
import { useZapPost } from "@/hooks/useZaps";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useToast } from "@/hooks/useToast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ZapDialogProps {
  eventId: string;
  authorPubkey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ZapDialog({
  eventId,
  authorPubkey,
  open,
  onOpenChange,
}: ZapDialogProps) {
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [defaultZapAmount] = useLocalStorage("default-zap-amount", "21");
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const zapPost = useZapPost();

  // Set default amount when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (newOpen) {
      setAmount(defaultZapAmount);
      setComment("");
    }
  };

  const handleZap = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to zap",
        variant: "destructive",
      });
      return;
    }

    const zapAmount = parseInt(amount);
    if (isNaN(zapAmount) || zapAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid zap amount",
        variant: "destructive",
      });
      return;
    }

    try {
      await zapPost.mutateAsync({
        eventId,
        authorPubkey,
        amount: zapAmount,
        comment: comment.trim(),
      });

      toast({
        title: "Zap sent!",
        description: `Successfully zapped ${zapAmount} sats`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Zap failed",
        description:
          error instanceof Error ? error.message : "Failed to send zap",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-orange-500" />
            <span>Send Zap</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="zap-amount">Amount (sats)</Label>
            <Input
              id="zap-amount"
              type="number"
              placeholder="21"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zap-comment">Comment (optional)</Label>
            <Textarea
              id="zap-comment"
              placeholder="Add a message with your zap..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Popular amounts:</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              {["21", "100", "500", "1000", "5000"].map((popularAmount) => (
                <Button
                  key={popularAmount}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(popularAmount)}
                  className="h-7 px-2 text-xs"
                >
                  {popularAmount} sats
                </Button>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleZap}
            disabled={zapPost.isPending}
          >
            {zapPost.isPending ? (
              <>
                <Zap className="h-4 w-4 mr-2 animate-pulse" />
                Sending zap...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Send {amount} sats
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
