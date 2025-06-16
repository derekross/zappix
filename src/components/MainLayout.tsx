import { useState } from 'react';
import { Camera, Home, Globe, Users, Search, Plus, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginArea } from '@/components/auth/LoginArea';
import { ImageFeed } from './ImageFeed';
import { HashtagGrid } from './HashtagGrid';
import { CreatePostDialog } from './CreatePostDialog';
import { BookmarksPage } from './BookmarksPage';
import { SettingsPage } from './SettingsPage';
import { ProfilePage } from './ProfilePage';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsMobile } from '@/hooks/useIsMobile';


export function MainLayout() {
  const [activeMainTab, setActiveMainTab] = useState('home');
  const [activeHomeTab, setActiveHomeTab] = useState('global');
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  const { user } = useCurrentUser();
  const isMobile = useIsMobile();
  
  const handleHashtagClick = (hashtag: string) => {
    setSelectedHashtag(hashtag);
    setActiveMainTab('hashtag-detail');
  };
  
  const handleBackToDiscover = () => {
    setSelectedHashtag(null);
    setActiveMainTab('discover');
  };
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Special layouts for bookmarks, settings, and profile pages
  if (showProfile) {
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
                    setShowProfile(false);
                    scrollToTop();
                  }}
                  className="font-bold text-lg"
                >
                  ← Zappix
                </Button>
              </div>
            </header>
            <main className="container py-6 pb-20">
              <ProfilePage />
            </main>
          </>
        ) : (
          // Desktop layout with sidebar
          <div className="flex">
            {/* Left Sidebar */}
            <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex h-full flex-col">
                {/* Logo */}
                <div className="flex h-14 items-center border-b px-6">
                  <button 
                    onClick={() => {
                      setShowProfile(false);
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
                <nav className="flex-1 space-y-2 p-4">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowProfile(false);
                      setActiveMainTab('home');
                    }}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Home
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowProfile(false);
                      setActiveMainTab('discover');
                    }}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Discover
                  </Button>
                </nav>
                
                {/* User Area */}
                <div className="border-t p-4">
                  {user && (
                    <Button
                      onClick={() => setShowCreatePost(true)}
                      className="w-full mb-4 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Post
                    </Button>
                  )}
                  <LoginArea 
                    className="w-full" 
                    onSettingsClick={() => setShowSettings(true)}
                    onBookmarksClick={() => setShowBookmarks(true)}
                    onProfileClick={() => setShowProfile(true)}
                  />
                </div>
              </div>
            </aside>
            
            {/* Main Content */}
            <main className="ml-64 flex-1 p-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">Edit Profile</h2>
                  <p className="text-muted-foreground">Update your Nostr profile information</p>
                </div>
                <ProfilePage />
              </div>
            </main>
          </div>
        )}
      </div>
    );
  }
  
  if (showBookmarks) {
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
                    setShowBookmarks(false);
                    scrollToTop();
                  }}
                  className="font-bold text-lg"
                >
                  ← Zappix
                </Button>
              </div>
            </header>
            <main className="container py-6 pb-20">
              <BookmarksPage />
            </main>
          </>
        ) : (
          // Desktop layout with sidebar
          <div className="flex">
            {/* Left Sidebar */}
            <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex h-full flex-col">
                {/* Logo */}
                <div className="flex h-14 items-center border-b px-6">
                  <button 
                    onClick={() => {
                      setShowBookmarks(false);
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
                <nav className="flex-1 space-y-2 p-4">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowBookmarks(false);
                      setActiveMainTab('home');
                    }}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Home
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowBookmarks(false);
                      setActiveMainTab('discover');
                    }}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Discover
                  </Button>
                </nav>
                
                {/* User Area */}
                <div className="border-t p-4">
                  {user && (
                    <Button
                      onClick={() => setShowCreatePost(true)}
                      className="w-full mb-4 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Post
                    </Button>
                  )}
                  <LoginArea 
                    className="w-full" 
                    onSettingsClick={() => setShowSettings(true)}
                    onBookmarksClick={() => setShowBookmarks(true)}
                    onProfileClick={() => setShowProfile(true)}
                  />
                </div>
              </div>
            </aside>
            
            {/* Main Content */}
            <main className="ml-64 flex-1 p-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">Bookmarks</h2>
                  <p className="text-muted-foreground">Your saved posts</p>
                </div>
                <BookmarksPage />
              </div>
            </main>
          </div>
        )}
      </div>
    );
  }
  
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
                <div className="flex h-14 items-center border-b px-6">
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
                <nav className="flex-1 space-y-2 p-4">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowSettings(false);
                      setActiveMainTab('home');
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
                      setActiveMainTab('discover');
                    }}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Discover
                  </Button>
                </nav>
                
                {/* User Area */}
                <div className="border-t p-4">
                  {user && (
                    <Button
                      onClick={() => setShowCreatePost(true)}
                      className="w-full mb-4 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Post
                    </Button>
                  )}
                  <LoginArea 
                    className="w-full" 
                    onSettingsClick={() => setShowSettings(true)}
                    onBookmarksClick={() => setShowBookmarks(true)}
                    onProfileClick={() => setShowProfile(true)}
                  />
                </div>
              </div>
            </aside>
            
            {/* Main Content */}
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
              <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">

                <TabsContent value="home" className="space-y-6">
                  <Tabs value={activeHomeTab} onValueChange={setActiveHomeTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="global" className="flex items-center space-x-2">
                        <Globe className="h-4 w-4" />
                        <span className="hidden sm:inline">Global</span>
                      </TabsTrigger>
                      <TabsTrigger value="following" className="flex items-center space-x-2">
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
                      <ImageFeed feedType="global" />
                    </TabsContent>

                    <TabsContent value="following" className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">Following</h2>
                        <p className="text-muted-foreground">
                          Posts from people you follow
                        </p>
                      </div>
                      <ImageFeed feedType="following" />
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent value="discover" className="space-y-6 lg:space-y-8">
                  <div className="text-center space-y-2 lg:space-y-3">
                    <h2 className="text-2xl lg:text-3xl font-bold">Discover</h2>
                    <p className="text-muted-foreground lg:text-lg">
                      Explore popular hashtags and communities
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
                          onClick={handleBackToDiscover}
                        >
                          ← Back
                        </Button>
                        <div>
                          <h2 className="text-2xl font-bold flex items-center space-x-2">
                            <Hash className="h-6 w-6 text-primary" />
                            <span>{selectedHashtag}</span>
                          </h2>
                          <p className="text-muted-foreground">
                            Posts tagged with #{selectedHashtag}
                          </p>
                        </div>
                      </div>
                      <ImageFeed feedType="global" hashtag={selectedHashtag} />
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
                onClick={() => setActiveMainTab('home')}
                className="flex flex-col items-center gap-1"
              >
                <Home className="h-5 w-5" />
                <span className="text-xs">Home</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveMainTab('discover')}
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
                  onBookmarksClick={() => setShowBookmarks(true)}
                  onProfileClick={() => setShowProfile(true)}
                />
                <span className="text-xs mt-1">Account</span>
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
              <div className="flex h-14 items-center border-b px-6">
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
              <nav className="flex-1 space-y-2 p-4">
                <Button
                  variant={activeMainTab === 'home' ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setActiveMainTab('home')}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Button>
                <Button
                  variant={activeMainTab === 'discover' || activeMainTab === 'hashtag-detail' ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setActiveMainTab('discover')}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Discover
                </Button>
              </nav>
              
              {/* User Area */}
              <div className="border-t p-4">
                {user && (
                  <Button
                    onClick={() => setShowCreatePost(true)}
                    className="w-full mb-4 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Post
                  </Button>
                )}
                <LoginArea 
                  className="w-full" 
                  onSettingsClick={() => setShowSettings(true)}
                  onBookmarksClick={() => setShowBookmarks(true)}
                  onProfileClick={() => setShowProfile(true)}
                />
              </div>
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="ml-64 flex-1 p-6">
            <div className="max-w-4xl mx-auto">
              <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
                <TabsContent value="home" className="space-y-6">
                  <Tabs value={activeHomeTab} onValueChange={setActiveHomeTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="global" className="flex items-center space-x-2">
                        <Globe className="h-4 w-4" />
                        <span>Global</span>
                      </TabsTrigger>
                      <TabsTrigger value="following" className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>Following</span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="global" className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">Global Feed</h2>
                        <p className="text-muted-foreground">
                          Latest image posts from all relays
                        </p>
                      </div>
                      <ImageFeed feedType="global" />
                    </TabsContent>

                    <TabsContent value="following" className="space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold">Following</h2>
                        <p className="text-muted-foreground">
                          Posts from people you follow
                        </p>
                      </div>
                      <ImageFeed feedType="following" />
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                <TabsContent value="discover" className="space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">Discover</h2>
                    <p className="text-muted-foreground">
                      Explore popular hashtags and communities
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
                          onClick={handleBackToDiscover}
                        >
                          ← Back
                        </Button>
                        <div>
                          <h2 className="text-2xl font-bold flex items-center space-x-2">
                            <Hash className="h-6 w-6 text-primary" />
                            <span>{selectedHashtag}</span>
                          </h2>
                          <p className="text-muted-foreground">
                            Posts tagged with #{selectedHashtag}
                          </p>
                        </div>
                      </div>
                      <ImageFeed feedType="global" hashtag={selectedHashtag} />
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      )}

      {/* Create Post Dialog */}
      <CreatePostDialog 
        open={showCreatePost} 
        onOpenChange={setShowCreatePost} 
      />
      
      {/* Footer - only show on desktop */}
      {!isMobile && (
        <footer className="ml-64 border-t py-6">
          <div className="container text-center text-sm text-muted-foreground">
            <p>
              Vibed with{' '}
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
    </div>
  );
}