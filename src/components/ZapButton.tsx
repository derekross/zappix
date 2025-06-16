import { useState, useCallback } from "react";
import { Zap, Loader2 } from "lucide-react";
import { useZapPost } from "@/hooks/useZaps";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useNWC } from "@/hooks/useNWC";
import { useLongPress } from "@/hooks/useLongPress";
import { Button } from "@/components/ui/button";
import { ZapDialog } from "./ZapDialog";
import { cn } from "@/lib/utils";

interface ZapButtonProps {
  eventId: string;
  authorPubkey: string;
  zapTotal?: number;
  size?: "sm" | "default";
  className?: string;
}

export function ZapButton({
  eventId,
  authorPubkey,
  zapTotal = 0,
  size = "default",
  className,
}: ZapButtonProps) {
  const [showDialog, setShowDialog] = useState(false);

  const { user } = useCurrentUser();
  const { toast } = useToast();
  const nwc = useNWC();
  const zapPost = useZapPost();
  const [defaultZapAmount] = useLocalStorage("default-zap-amount", "21");

  // Quick zap with default amount
  const handleQuickZap = useCallback(async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to send zaps",
        variant: "destructive",
      });
      return;
    }

    if (!nwc.isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please configure a wallet connection in settings",
        variant: "destructive",
      });
      return;
    }

    const amount = parseInt(defaultZapAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid default amount",
        description: "Please set a valid default zap amount in settings",
        variant: "destructive",
      });
      return;
    }

    try {
      await zapPost.mutateAsync({
        eventId,
        authorPubkey,
        amount,
        comment: "", // No comment for quick zaps
      });

      toast({
        title: "Quick zap sent! ⚡",
        description: `Successfully zapped ${amount} sats`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send zap";
      toast({
        title: "Zap failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [
    user,
    nwc.isConnected,
    defaultZapAmount,
    eventId,
    authorPubkey,
    zapPost,
    toast,
  ]);

  // Long press opens dialog
  const handleLongPress = useCallback(() => {
    setShowDialog(true);
  }, []);

  const longPressProps = useLongPress({
    onLongPress: handleLongPress,
    onClick: handleQuickZap,
    threshold: 500, // 500ms for long press
  });

  const isLoading = zapPost.isPending;
  const buttonSize = size === "sm" ? "sm" : "sm";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  // Format zap total with appropriate suffix
  const formatZapTotal = (total: number) => {
    if (total >= 1000000) {
      return `${(total / 1000000).toFixed(1)}M`;
    } else if (total >= 1000) {
      return `${(total / 1000).toFixed(1)}K`;
    }
    return total.toString();
  };

  return (
    <>
      <Button
        variant="ghost"
        size={buttonSize}
        className={cn("flex items-center space-x-1", className)}
        disabled={isLoading}
        onMouseDown={longPressProps.onMouseDown}
        onMouseUp={longPressProps.onMouseUp}
        onMouseLeave={longPressProps.onMouseLeave}
        onTouchStart={longPressProps.onTouchStart}
        onTouchEnd={longPressProps.onTouchEnd}
        onClick={longPressProps.onClick}
      >
        {isLoading ? (
          <Loader2 className={cn(iconSize, "animate-spin text-orange-500")} />
        ) : (
          <Zap className={cn(iconSize, "text-orange-500")} />
        )}
        {zapTotal > 0 && (
          <span className="text-xs text-muted-foreground">
            {formatZapTotal(zapTotal)}
          </span>
        )}
      </Button>

      <ZapDialog
        eventId={eventId}
        authorPubkey={authorPubkey}
        open={showDialog}
        onOpenChange={setShowDialog}
      />
    </>
  );
}
