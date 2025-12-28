import { memo } from "react";
import { Camera } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

interface MobileHeaderProps {
  onLogoClick: () => void;
}

export const MobileHeader = memo(function MobileHeader({
  onLogoClick,
}: MobileHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="container flex h-14 items-center justify-between">
        <div className="flex-1" />
        <button
          onClick={onLogoClick}
          className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <Camera className="h-6 w-6 text-primary" />
          <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Zappix
          </h1>
        </button>
        <div className="flex-1 flex justify-end">
          <NotificationBell variant="mobile" />
        </div>
      </div>
    </header>
  );
});
