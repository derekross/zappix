import { useState, useEffect, ReactNode } from "react";
import {
  Camera,
  Home,
  Globe,
  Users,
  Search,
  Plus,
  Hash,
  MapPin,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginArea } from "@/components/auth/LoginArea";
import { ImageFeed } from "./ImageFeed";
import { VideoFeed } from "./VideoFeed";
import { HashtagGrid } from "./HashtagGrid";
import { CreatePostDialog } from "./CreatePostDialog";

import { SettingsPage } from "./SettingsPage";


import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/useIsMobile";

interface MainLayoutProps {
  children?: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [activeMainTab, setActiveMainTab] = useState("home");
  const [activeHomeTab, setActiveHomeTab] = useState("global");
  const [activeVideoTab, setActiveVideoTab] = useState("global");
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<string>("discover"); // Track where user came from
  const [showCreatePost, setShowCreatePost] = useState(false);

  const [showSettings, setShowSettings] = useState(false);



  const { user } = useCurrentUser();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle route changes
  useEffect(() => {
    // Handle location route
    const locationMatch = location.pathname.match(/^\/location\/(.+)$/);
    if (locationMatch) {
      const decodedLocation = decodeURIComponent(locationMatch[1]);
      setSelectedLocation(decodedLocation);
      setActiveMainTab("location-detail");
      // If coming from a post page, set previousTab to 'home' (or location.state?.from)
      if (location.state && location.state.from) {
        setPreviousTab(location.state.from);
      }
      return;
    }

    // Handle main routes
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTabChange = (value: string) => {
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
        // Don't change the URL for detail views
        setActiveMainTab(value);
        break;
      default:
        setActiveMainTab(value);
    }
  };

  const handleHashtagClick = (hashtag: string) => {
    // Only update previousTab if we're not already on a hashtag detail page
    // This preserves the original source when navigating between hashtags
    if (activeMainTab !== "hashtag-detail") {
      setPreviousTab(activeMainTab);
    }
    setSelectedHashtag(hashtag);
    setSelectedLocation(null);
    setActiveMainTab("hashtag-detail");
    // Scroll to top when navigating to hashtag feed
    scrollToTop();
  };

  const handleLocationClick = (location: string) => {
    setSelectedLocation(location);
    setActiveMainTab("location-detail");
    setPreviousTab(activeMainTab);
    navigate(`/location/${encodeURIComponent(location)}`, {
      state: { from: activeMainTab },
    });
  };

  const handleBackToPrevious = () => {
    switch (previousTab) {
      case "home":
        navigate("/home");
        setActiveMainTab("home");
        setSelectedHashtag(null);
        setSelectedLocation(null);
        break;
      case "discover":
        navigate("/discover");
        setActiveMainTab("discover");
        setSelectedHashtag(null);
        setSelectedLocation(null);
        break;
      default:
        // If we're coming from a hashtag or location detail, go back to discover
        if (
          activeMainTab === "hashtag-detail" ||
          activeMainTab === "location-detail"
        ) {
          navigate("/discover");
          setActiveMainTab("discover");
          setSelectedHashtag(null);
          setSelectedLocation(null);
        }
    }
  };

  const getBackButtonText = () => {
    switch (previousTab) {
      case "home":
        return "Back to Home";
      case "discover":
        return "Back to Discover";
      default:
        return "Back";
    }
  };

  // Special layouts for settings pages

  if (showSettings) {
    return (
      <div className="min-h-screen bg-background">
        {isMobile ? (
          // Mobile layout with header
          <>
            <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container flex h-14 items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowSettings(false);
                    scrollToTop();
                  }}
                  className="font-bold text-lg"
                >
                  ← Zappix
                </Button>
              </div>
            </header>
            <main className="container py-6 pb-20">
              <SettingsPage />
            </main>
          </>
        ) : (
          // Desktop layout with sidebar
          <div className="flex">
            {/* Left Sidebar */}
            <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex h-full flex-col">
                {/* Logo */}
                <div className="flex h-14 items-center px-4">
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      scrollToTop();
                    }}
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
                    onClick={() => {
                      setShowSettings(false);
                      navigate("/home");
                    }}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Home
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowSettings(false);
                      navigate("/videos");
                    }}
                  >
                    <Film className="mr-2 h-4 w-4" />
                    Flix
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowSettings(false);
                      navigate("/discover");
                    }}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Discover
                  </Button>
                  {user && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setShowCreatePost(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Post
                    </Button>
                  )}
                </nav>

                {/* Account Area */}
                <div className="p-2">
                  <LoginArea
                    onSettingsClick={() => setShowSettings(true)}
                    onBookmarksClick={() => navigate("/bookmarks")}
                    onProfileClick={() => navigate("/profile")}
                  />
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1 p-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">Settings</h2>
                  <p className="text-muted-foreground">
                    Manage your account and preferences
                  </p>
                </div>
                <SettingsPage />
              </div>
            </main>
          </div>
        )}
      </div>
    );
  }



  // If children are provided, render them in the main content area
  if (children) {
    return (
      <div className="min-h-screen bg-background">
        {isMobile ? (
          // Mobile layout with header
          <>
            <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container flex h-14 items-center justify-center">
                <button
                  onClick={scrollToTop}
                  className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Camera className="h-6 w-6 text-primary" />
                  <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Zappix
                  </h1>
                </button>
              </div>
            </header>

            {/* Main Content */}
            <main className="container py-6 pb-20">{children}</main>

            {/* Mobile Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex justify-around items-center py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/home")}
                  className="flex flex-col items-center gap-1"
                >
                  <Home className="h-5 w-5" />
                  <span className="text-xs">Home</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/videos")}
                  className="flex flex-col items-center gap-1"
                >
                  <Film className="h-5 w-5" />
                  <span className="text-xs">Flix</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/discover")}
                  className="flex flex-col items-center gap-1"
                >
                  <Search className="h-5 w-5" />
                  <span className="text-xs">Discover</span>
                </Button>

                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreatePost(true)}
                    className="flex flex-col items-center gap-1"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-xs">Post</span>
                  </Button>
                )}

                <div className="flex flex-col items-center">
                  <LoginArea
                    className="max-w-none"
                    onSettingsClick={() => setShowSettings(true)}
                    onBookmarksClick={() => navigate("/bookmarks")}
                    onProfileClick={() => navigate("/profile")}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          // Desktop layout with left sidebar
          <div className="flex">
            {/* Left Sidebar */}
            <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex h-full flex-col">
                {/* Logo */}
                <div className="flex h-14 items-center px-4">
                  <button
                    onClick={scrollToTop}
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
                    onClick={() => navigate("/home")}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Home
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate("/videos")}
                  >
                    <Film className="mr-2 h-4 w-4" />
                    Flix
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate("/discover")}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Discover
                  </Button>
                  {user && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setShowCreatePost(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Post
                    </Button>
                  )}
                </nav>

                {/* Account Area */}
                <div className="p-2">
                  <LoginArea
                    onSettingsClick={() => setShowSettings(true)}
                    onBookmarksClick={() => navigate("/bookmarks")}
                    onProfileClick={() => navigate("/profile")}
                  />
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1 p-6">{children}</main>
          </div>
        )}

        {!isMobile && (
          <footer className="ml-64 border-t py-6">
            <div className="container text-center text-sm text-muted-foreground">
              <p>
                Vibed with{" "}
                <a
                  href="https://soapbox.pub/tools/mkstack/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  MKStack
                </a>
              </p>
            </div>
          </footer>
        )}

        <CreatePostDialog
          open={showCreatePost}
          onOpenChange={setShowCreatePost}
        />
      </div>
    );
  }

  // Main layout
  return (
    <div className="min-h-screen bg-background">
      {isMobile ? (
        // Mobile layout with top header
        <>
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-center">
              <button
                onClick={scrollToTop}
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <Camera className="h-6 w-6 text-primary" />
                <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Zappix
                </h1>
              </button>
            </div>
          </header>

          {/* Main Content */}
          <main className="container py-6 pb-20">
            <div className="max-w-6xl mx-auto">
              <Tabs
                value={activeMainTab}
                onValueChange={handleTabChange}
                className="w-full"
              >
                <TabsContent value="home" className="space-y-6">
                  <Tabs
                    value={activeHomeTab}
                    onValueChange={setActiveHomeTab}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger
                        value="global"
                        className="flex items-center space-x-2"
                      >
                        <Globe className="h-4 w-4" />
                        <span className="hidden sm:inline">Global</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="following"
                        className="flex items-center space-x-2"
                      >
                        <Users className="h-4 w-4" />
                        <span className="hidden sm:inline">Following</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="global" className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">Global Feed</h2>
                        <p className="text-muted-foreground">
                          Latest image posts from all relays
                        </p>
                      </div>
                      <ImageFeed
                        feedType="global"
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                      />
                    </TabsContent>

                    <TabsContent value="following" className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">Following Feed</h2>
                        <p className="text-muted-foreground">
                          Latest image posts from people you follow
                        </p>
                      </div>
                      <ImageFeed
                        feedType="following"
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                      />
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent value="videos" className="space-y-6">
                  <Tabs
                    value={activeVideoTab}
                    onValueChange={setActiveVideoTab}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger
                        value="global"
                        className="flex items-center space-x-2"
                      >
                        <Globe className="h-4 w-4" />
                        <span className="hidden sm:inline">Global</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="following"
                        className="flex items-center space-x-2"
                      >
                        <Users className="h-4 w-4" />
                        <span className="hidden sm:inline">Following</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="global" className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">Global Flix</h2>
                        <p className="text-muted-foreground">
                          Latest vertical videos from all relays - TikTok-style feed
                        </p>
                      </div>
                      <VideoFeed
                        feedType="global"
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                      />
                    </TabsContent>

                    <TabsContent value="following" className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">Following Flix</h2>
                        <p className="text-muted-foreground">
                          Latest vertical videos from people you follow
                        </p>
                      </div>
                      <VideoFeed
                        feedType="following"
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                      />
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent value="discover" className="space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">Discover</h2>
                    <p className="text-muted-foreground">
                      Explore trending hashtags and locations
                    </p>
                  </div>
                  <HashtagGrid onHashtagClick={handleHashtagClick} />
                </TabsContent>

                <TabsContent value="hashtag-detail" className="space-y-6">
                  {selectedHashtag && (
                    <>
                      <div className="flex items-center space-x-4">
                        <Button
                          variant="outline"
                          onClick={handleBackToPrevious}
                        >
                          {getBackButtonText()}
                        </Button>
                        <div>
                          <h2 className="text-2xl font-bold flex items-center space-x-2">
                            <Hash className="h-6 w-6 text-primary" />
                            <span>#{selectedHashtag}</span>
                          </h2>
                          <p className="text-muted-foreground">
                            Posts tagged with #{selectedHashtag}
                          </p>
                        </div>
                      </div>
                      <ImageFeed
                        feedType="global"
                        hashtag={selectedHashtag}
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                      />
                    </>
                  )}
                </TabsContent>

                <TabsContent value="location-detail" className="space-y-6">
                  {selectedLocation && (
                    <>
                      <div className="flex items-center space-x-4">
                        <Button
                          variant="outline"
                          onClick={handleBackToPrevious}
                        >
                          {getBackButtonText()}
                        </Button>
                        <div>
                          <h2 className="text-2xl font-bold flex items-center space-x-2">
                            <MapPin className="h-6 w-6 text-primary" />
                            <span>{selectedLocation}</span>
                          </h2>
                          <p className="text-muted-foreground">
                            Posts from {selectedLocation}
                          </p>
                        </div>
                      </div>
                      <ImageFeed
                        feedType="global"
                        location={selectedLocation}
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                        key={`location-${selectedLocation}`}
                      />
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </main>

          {/* Mobile Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex justify-around items-center py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleTabChange("home")}
                className="flex flex-col items-center gap-1"
              >
                <Home className="h-5 w-5" />
                <span className="text-xs">Home</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleTabChange("videos")}
                className="flex flex-col items-center gap-1"
              >
                <Film className="h-5 w-5" />
                <span className="text-xs">Flix</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleTabChange("discover")}
                className="flex flex-col items-center gap-1"
              >
                <Search className="h-5 w-5" />
                <span className="text-xs">Discover</span>
              </Button>

              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreatePost(true)}
                  className="flex flex-col items-center gap-1"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs">Post</span>
                </Button>
              )}

              <div className="flex flex-col items-center">
                <LoginArea
                  className="max-w-none"
                  onSettingsClick={() => setShowSettings(true)}
                  onBookmarksClick={() => navigate("/bookmarks")}
                  onProfileClick={() => navigate("/profile")}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        // Desktop layout with left sidebar
        <div className="flex">
          {/* Left Sidebar */}
          <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-full flex-col">
              {/* Logo */}
              <div className="flex h-14 items-center px-4">
                <button
                  onClick={scrollToTop}
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
                  onClick={() => handleTabChange("home")}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleTabChange("videos")}
                >
                  <Film className="mr-2 h-4 w-4" />
                  Flix
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => handleTabChange("discover")}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Discover
                </Button>

                {user && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setShowCreatePost(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Post
                  </Button>
                )}
              </nav>

              {/* Account Area */}
              <div className="p-2">
                <LoginArea
                  onSettingsClick={() => setShowSettings(true)}
                  onBookmarksClick={() => navigate("/bookmarks")}
                  onProfileClick={() => navigate("/profile")}
                />
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="ml-64 flex-1 p-6">
            <div className="max-w-4xl mx-auto">
              <Tabs
                value={activeMainTab}
                onValueChange={handleTabChange}
                className="w-full"
              >
                <TabsContent value="home" className="space-y-6">
                  <Tabs
                    value={activeHomeTab}
                    onValueChange={setActiveHomeTab}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger
                        value="global"
                        className="flex items-center space-x-2"
                      >
                        <Globe className="h-4 w-4" />
                        <span className="hidden sm:inline">Global</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="following"
                        className="flex items-center space-x-2"
                      >
                        <Users className="h-4 w-4" />
                        <span className="hidden sm:inline">Following</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="global" className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">Global Feed</h2>
                        <p className="text-muted-foreground">
                          Latest image posts from all relays
                        </p>
                      </div>
                      <ImageFeed
                        feedType="global"
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                      />
                    </TabsContent>

                    <TabsContent value="following" className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">Following Feed</h2>
                        <p className="text-muted-foreground">
                          Latest image posts from people you follow
                        </p>
                      </div>
                      <ImageFeed
                        feedType="following"
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                      />
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent value="videos" className="space-y-6">
                  <Tabs
                    value={activeVideoTab}
                    onValueChange={setActiveVideoTab}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger
                        value="global"
                        className="flex items-center space-x-2"
                      >
                        <Globe className="h-4 w-4" />
                        <span className="hidden sm:inline">Global</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="following"
                        className="flex items-center space-x-2"
                      >
                        <Users className="h-4 w-4" />
                        <span className="hidden sm:inline">Following</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="global" className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold mb-2">Global Flix</h2>
                        <p className="text-muted-foreground">
                          Latest vertical videos from all relays - TikTok-style feed
                        </p>
                      </div>
                      <VideoFeed
                        feedType="global"
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                      />
                    </TabsContent>

                    <TabsContent value="following" className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold mb-2">Following Flix</h2>
                        <p className="text-muted-foreground">
                          Latest vertical videos from people you follow
                        </p>
                      </div>
                      <VideoFeed
                        feedType="following"
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                      />
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent value="discover" className="space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold mb-2">Discover</h2>
                    <p className="text-muted-foreground">
                      Explore popular hashtags and communities
                    </p>
                  </div>
                  <HashtagGrid
                    onHashtagClick={handleHashtagClick}
                    onLocationClick={handleLocationClick}
                  />
                </TabsContent>

                <TabsContent value="hashtag-detail" className="space-y-6">
                  {selectedHashtag && (
                    <>
                      <div className="flex items-center space-x-4">
                        <Button
                          variant="outline"
                          onClick={handleBackToPrevious}
                        >
                          {getBackButtonText()}
                        </Button>
                        <div>
                          <h2 className="text-2xl font-bold flex items-center space-x-2">
                            <Hash className="h-6 w-6 text-primary" />
                            <span>#{selectedHashtag}</span>
                          </h2>
                          <p className="text-muted-foreground">
                            Posts tagged with #{selectedHashtag}
                          </p>
                        </div>
                      </div>
                      <ImageFeed
                        feedType="global"
                        hashtag={selectedHashtag}
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                      />
                    </>
                  )}
                </TabsContent>

                <TabsContent value="location-detail" className="space-y-6">
                  {selectedLocation && (
                    <>
                      <div className="flex items-center space-x-4">
                        <Button
                          variant="outline"
                          onClick={handleBackToPrevious}
                        >
                          {getBackButtonText()}
                        </Button>
                        <div>
                          <h2 className="text-2xl font-bold flex items-center space-x-2">
                            <MapPin className="h-6 w-6 text-primary" />
                            <span>{selectedLocation}</span>
                          </h2>
                          <p className="text-muted-foreground">
                            Posts from {selectedLocation}
                          </p>
                        </div>
                      </div>
                      <ImageFeed
                        feedType="global"
                        location={selectedLocation}
                        onHashtagClick={handleHashtagClick}
                        onLocationClick={handleLocationClick}
                      />
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      )}

      {!isMobile && (
        <footer className="ml-64 border-t py-6">
          <div className="container text-center text-sm text-muted-foreground">
            <p>
              Vibed with{" "}
              <a
                href="https://soapbox.pub/tools/mkstack/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                MKStack
              </a>
            </p>
          </div>
        </footer>
      )}

      <CreatePostDialog
        open={showCreatePost}
        onOpenChange={setShowCreatePost}
      />
    </div>
  );
}
