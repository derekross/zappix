import { memo } from "react";
import { Home, Film, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginArea } from "@/components/auth/LoginArea";
import { useNavigate } from "react-router-dom";

interface MobileBottomNavProps {
  user: { pubkey: string } | null | undefined;
  onCreatePost: () => void;
  onSettingsClick: () => void;
  onTabChange?: (tab: string) => void;
}

export const MobileBottomNav = memo(function MobileBottomNav({
  user,
  onCreatePost,
  onSettingsClick,
  onTabChange,
}: MobileBottomNavProps) {
  const navigate = useNavigate();

  const handleNavClick = (tab: string, path: string) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      navigate(path);
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex justify-around items-center py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleNavClick("home", "/home")}
          className="flex flex-col items-center gap-1"
        >
          <Home className="h-5 w-5" />
          <span className="text-xs">Home</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleNavClick("videos", "/videos")}
          className="flex flex-col items-center gap-1"
        >
          <Film className="h-5 w-5" />
          <span className="text-xs">Flix</span>
        </Button>

        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreatePost}
            className="flex flex-col items-center gap-1"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs">Post</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleNavClick("discover", "/discover")}
          className="flex flex-col items-center gap-1"
        >
          <Search className="h-5 w-5" />
          <span className="text-xs">Discover</span>
        </Button>

        <div className="flex flex-col items-center">
          <LoginArea
            className="max-w-none"
            onSettingsClick={onSettingsClick}
            onBookmarksClick={() => navigate("/bookmarks")}
            onProfileClick={() => navigate("/profile")}
          />
        </div>
      </div>
    </div>
  );
});
