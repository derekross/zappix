import { memo } from "react";
import { Camera, Home, Film, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginArea } from "@/components/auth/LoginArea";
import { NotificationBell } from "@/components/NotificationBell";
import { useNavigate } from "react-router-dom";

interface DesktopSidebarProps {
  user: { pubkey: string } | null | undefined;
  onLogoClick: () => void;
  onCreatePost: () => void;
  onSettingsClick: () => void;
  onTabChange?: (tab: string) => void;
}

export const DesktopSidebar = memo(function DesktopSidebar({
  user,
  onLogoClick,
  onCreatePost,
  onSettingsClick,
  onTabChange,
}: DesktopSidebarProps) {
  const navigate = useNavigate();

  const handleNavClick = (tab: string, path: string) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      navigate(path);
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center px-4">
          <button
            onClick={onLogoClick}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <Camera className="h-6 w-6 text-primary" />
            <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Zappix
            </h1>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => handleNavClick("home", "/home")}
          >
            <Home className="mr-2 h-4 w-4" />
            Home
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => handleNavClick("videos", "/videos")}
          >
            <Film className="mr-2 h-4 w-4" />
            Flix
          </Button>

          {user && (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={onCreatePost}
            >
              <Plus className="mr-2 h-4 w-4" />
              Post
            </Button>
          )}

          {user && <NotificationBell />}

          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => handleNavClick("discover", "/discover")}
          >
            <Search className="mr-2 h-4 w-4" />
            Discover
          </Button>
        </nav>

        {/* Account Area */}
        <div className="p-2">
          <LoginArea
            onSettingsClick={onSettingsClick}
            onBookmarksClick={() => navigate("/bookmarks")}
            onProfileClick={() => navigate("/profile")}
          />
        </div>
      </div>
    </aside>
  );
});
