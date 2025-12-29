import { useState, useEffect, ReactNode, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { HashtagGrid } from "./HashtagGrid";
import { CreatePostDialog } from "./CreatePostDialog";
import { SettingsPage } from "./SettingsPage";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  DesktopSidebar,
  MobileHeader,
  MobileBottomNav,
  FeedTabs,
  DetailView,
} from "./layout";

interface MainLayoutProps {
  children?: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [activeMainTab, setActiveMainTab] = useState("home");
  const [activeHomeTab, setActiveHomeTab] = useState("global");
  const [activeVideoTab, setActiveVideoTab] = useState("global");
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<string>("discover");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { user } = useCurrentUser();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Handle route changes
  useEffect(() => {
    const locationMatch = location.pathname.match(/^\/location\/(.+)$/);
    if (locationMatch) {
      const decodedLocation = decodeURIComponent(locationMatch[1]);
      setSelectedLocation(decodedLocation);
      setActiveMainTab("location-detail");
      if (location.state && location.state.from) {
        setPreviousTab(location.state.from);
      }
      return;
    }

    switch (location.pathname) {
      case "/home":
        setActiveMainTab("home");
        setSelectedHashtag(null);
        setSelectedLocation(null);
        break;
      case "/videos":
        setActiveMainTab("videos");
        setSelectedHashtag(null);
        setSelectedLocation(null);
        break;
      case "/discover":
        setActiveMainTab("discover");
        setSelectedHashtag(null);
        setSelectedLocation(null);
        break;
    }
  }, [location]);

  const handleTabChange = useCallback((value: string) => {
    switch (value) {
      case "home":
        navigate("/home");
        setActiveMainTab("home");
        setSelectedHashtag(null);
        setSelectedLocation(null);
        break;
      case "videos":
        navigate("/videos");
        setActiveMainTab("videos");
        setSelectedHashtag(null);
        setSelectedLocation(null);
        break;
      case "discover":
        navigate("/discover");
        setActiveMainTab("discover");
        setSelectedHashtag(null);
        setSelectedLocation(null);
        break;
      case "hashtag-detail":
      case "location-detail":
        setActiveMainTab(value);
        break;
      default:
        setActiveMainTab(value);
    }
  }, [navigate]);

  const handleHashtagClick = useCallback((hashtag: string) => {
    if (activeMainTab !== "hashtag-detail") {
      setPreviousTab(activeMainTab);
    }
    setSelectedHashtag(hashtag);
    setSelectedLocation(null);
    setActiveMainTab("hashtag-detail");
    scrollToTop();
  }, [activeMainTab, scrollToTop]);

  const handleLocationClick = useCallback((loc: string) => {
    setSelectedLocation(loc);
    setActiveMainTab("location-detail");
    setPreviousTab(activeMainTab);
    navigate(`/location/${encodeURIComponent(loc)}`, { state: { from: activeMainTab } });
  }, [activeMainTab, navigate]);

  const handleBackToPrevious = useCallback(() => {
    switch (previousTab) {
      case "home":
        navigate("/home");
        setActiveMainTab("home");
        break;
      case "discover":
        navigate("/discover");
        setActiveMainTab("discover");
        break;
      default:
        if (activeMainTab === "hashtag-detail" || activeMainTab === "location-detail") {
          navigate("/discover");
          setActiveMainTab("discover");
        }
    }
    setSelectedHashtag(null);
    setSelectedLocation(null);
  }, [previousTab, activeMainTab, navigate]);

  const getBackButtonText = useCallback(() => {
    switch (previousTab) {
      case "home": return "Back to Home";
      case "discover": return "Back to Discover";
      default: return "Back";
    }
  }, [previousTab]);

  const handleLogoClick = useCallback(() => {
    if (showSettings) {
      setShowSettings(false);
    }
    scrollToTop();
  }, [showSettings, scrollToTop]);

  const handleCreatePost = useCallback(() => setShowCreatePost(true), []);
  const handleSettingsClick = useCallback(() => setShowSettings(true), []);

  // Settings page layout
  if (showSettings) {
    return (
      <div className="min-h-screen bg-background">
        {isMobile ? (
          <>
            <header
              className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
              <div className="px-2 flex h-14 items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={() => { setShowSettings(false); scrollToTop(); }}
                  className="font-bold text-lg"
                >
                  ← Zappix
                </Button>
              </div>
            </header>
            <main className="py-4 pb-20 px-2">
              <SettingsPage />
            </main>
          </>
        ) : (
          <div className="flex">
            <DesktopSidebar
              user={user}
              onLogoClick={() => { setShowSettings(false); scrollToTop(); }}
              onCreatePost={handleCreatePost}
              onSettingsClick={handleSettingsClick}
            />
            <main className="ml-64 flex-1 p-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">Settings</h2>
                  <p className="text-muted-foreground">Manage your account and preferences</p>
                </div>
                <SettingsPage />
              </div>
            </main>
          </div>
        )}
      </div>
    );
  }

  // Children layout (for pages like profile, bookmarks)
  if (children) {
    return (
      <div className="min-h-screen bg-background">
        {isMobile ? (
          <>
            <MobileHeader onLogoClick={scrollToTop} />
            <main className="py-4 pb-20">{children}</main>
            <MobileBottomNav
              user={user}
              onCreatePost={handleCreatePost}
              onSettingsClick={handleSettingsClick}
            />
          </>
        ) : (
          <div className="flex">
            <DesktopSidebar
              user={user}
              onLogoClick={scrollToTop}
              onCreatePost={handleCreatePost}
              onSettingsClick={handleSettingsClick}
            />
            <main className="ml-64 flex-1 p-6">{children}</main>
          </div>
        )}

        {!isMobile && (
          <footer className="ml-64 border-t py-6">
            <div className="container text-center text-sm text-muted-foreground">
              <p>
                Vibed with{" "}
                <a href="https://soapbox.pub/tools/mkstack/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  MKStack
                </a>
              </p>
            </div>
          </footer>
        )}

        <CreatePostDialog open={showCreatePost} onOpenChange={setShowCreatePost} />
      </div>
    );
  }

  // Main layout with feeds
  const mainContent = (
    <Tabs value={activeMainTab} onValueChange={handleTabChange} className="w-full">
      <TabsContent value="home" className="space-y-6">
        <FeedTabs
          type="image"
          activeTab={activeHomeTab}
          onActiveTabChange={setActiveHomeTab}
          onHashtagClick={handleHashtagClick}
          onLocationClick={handleLocationClick}
        />
      </TabsContent>

      <TabsContent value="videos" className="space-y-6">
        <FeedTabs
          type="video"
          activeTab={activeVideoTab}
          onActiveTabChange={setActiveVideoTab}
          onHashtagClick={handleHashtagClick}
          onLocationClick={handleLocationClick}
        />
      </TabsContent>

      <TabsContent value="discover" className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Discover</h2>
          <p className="text-muted-foreground">Explore trending hashtags and locations</p>
        </div>
        <HashtagGrid onHashtagClick={handleHashtagClick} onLocationClick={handleLocationClick} />
      </TabsContent>

      <TabsContent value="hashtag-detail" className="space-y-6">
        {selectedHashtag && (
          <DetailView
            type="hashtag"
            value={selectedHashtag}
            backButtonText={getBackButtonText()}
            onBack={handleBackToPrevious}
            onHashtagClick={handleHashtagClick}
            onLocationClick={handleLocationClick}
          />
        )}
      </TabsContent>

      <TabsContent value="location-detail" className="space-y-6">
        {selectedLocation && (
          <DetailView
            type="location"
            value={selectedLocation}
            backButtonText={getBackButtonText()}
            onBack={handleBackToPrevious}
            onHashtagClick={handleHashtagClick}
            onLocationClick={handleLocationClick}
          />
        )}
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="min-h-screen bg-background">
      {isMobile ? (
        <>
          <MobileHeader onLogoClick={handleLogoClick} />
          <main className="py-4 pb-20">
            <div className="max-w-6xl mx-auto px-2 sm:px-6">{mainContent}</div>
          </main>
          <MobileBottomNav
            user={user}
            onCreatePost={handleCreatePost}
            onSettingsClick={handleSettingsClick}
            onTabChange={handleTabChange}
          />
        </>
      ) : (
        <div className="flex">
          <DesktopSidebar
            user={user}
            onLogoClick={handleLogoClick}
            onCreatePost={handleCreatePost}
            onSettingsClick={handleSettingsClick}
            onTabChange={handleTabChange}
          />
          <main className="ml-64 flex-1 p-6">
            <div className="max-w-4xl mx-auto">{mainContent}</div>
          </main>
        </div>
      )}

      {!isMobile && (
        <footer className="ml-64 border-t py-6">
          <div className="container text-center text-sm text-muted-foreground">
            <p>
              Vibed with{" "}
              <a href="https://soapbox.pub/tools/mkstack/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                MKStack
              </a>
            </p>
          </div>
        </footer>
      )}

      <CreatePostDialog open={showCreatePost} onOpenChange={setShowCreatePost} />
    </div>
  );
}
