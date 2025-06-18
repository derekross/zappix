import { useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useBookmarks, useBookmarkList, useCreateInitialBookmarkList } from "@/hooks/useBookmarks";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ImagePost } from "./ImagePost";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, Hash, RefreshCw } from "lucide-react";
import { MainLayout } from "./MainLayout";
import { Button } from "@/components/ui/button";
import { ImageFeed } from "./ImageFeed";

function BookmarkSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-center space-x-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
      <Skeleton className="aspect-square w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </Card>
  );
}

function BookmarksContent() {
  const { user } = useCurrentUser();
  const bookmarks = useBookmarks();
  const bookmarkList = useBookmarkList();
  const { mutate: createInitialBookmarkList, isPending: isCreatingList } = useCreateInitialBookmarkList();
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);

  // Debug logging
  console.log('BookmarksContent Debug:', {
    userPubkey: user?.pubkey,
    isLoading: bookmarks.isLoading,
    error: bookmarks.error,
    dataLength: bookmarks.data?.length,
    data: bookmarks.data,
    hasBookmarkList: !!bookmarkList.data,
    bookmarkListLoading: bookmarkList.isLoading
  });

  const handleHashtagClick = (hashtag: string) => {
    setSelectedHashtag(hashtag);
    // Scroll to top when navigating to hashtag feed
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToBookmarks = () => {
    setSelectedHashtag(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCreateBookmarkList = () => {
    createInitialBookmarkList();
  };

  if (!user) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <Bookmark className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Login Required</h3>
              <p className="text-muted-foreground">
                Please log in to view your bookmarks
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bookmarks.isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold flex items-center justify-center space-x-2">
            <Bookmark className="h-6 w-6 text-primary" />
            <span>Your Bookmarks</span>
          </h2>
          <p className="text-muted-foreground">Your saved image posts</p>
        </div>

        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <BookmarkSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (bookmarks.error) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <Bookmark className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Error Loading Bookmarks</h3>
              <p className="text-muted-foreground">
                Failed to load your bookmarks. Please try again.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show hashtag detail view if a hashtag is selected
  if (selectedHashtag) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={handleBackToBookmarks}
          >
            Back to Bookmarks
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
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold flex items-center justify-center space-x-2">
          <Bookmark className="h-6 w-6 text-primary" />
          <span>Your Bookmarks</span>
        </h2>
        <p className="text-muted-foreground">Your saved image posts</p>
      </div>

      {!bookmarks.data || bookmarks.data.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <Bookmark className="h-12 w-12 text-muted-foreground mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Bookmarks Yet</h3>
                <p className="text-muted-foreground">
                  {!bookmarkList.data && !bookmarkList.isLoading 
                    ? "You don't have a bookmark set yet. Create one to start bookmarking posts."
                    : "Start bookmarking image posts to see them here"
                  }
                </p>
                {!bookmarkList.data && !bookmarkList.isLoading && (
                  <Button 
                    onClick={handleCreateBookmarkList}
                    disabled={isCreatingList}
                    className="mt-4"
                  >
                    {isCreatingList ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Bookmark Set"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Bookmarks (Kind 30003)</h3>
            <p className="text-muted-foreground">
              Your bookmark set "nip-68-posts" - {bookmarks.data.length} item{bookmarks.data.length !== 1 ? 's' : ''}
            </p>
            {bookmarks.data.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Event kinds: {bookmarks.data.map(e => e.kind).join(', ')}
              </div>
            )}
          </div>
          {bookmarks.data.map((post) => {
            // For now, try to render all events, but handle different kinds appropriately
            if (post.kind === 20) {
              return (
                <ImagePost 
                  key={post.id} 
                  event={post} 
                  onHashtagClick={handleHashtagClick}
                />
              );
            } else {
              // For other kinds, show a simple card with basic info
              return (
                <Card key={post.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Kind {post.kind} Event</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(post.created_at * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {post.content || 'No content'}
                      </p>
                      <div className="text-xs text-muted-foreground">
                        ID: {post.id.slice(0, 16)}...
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}

export function BookmarksPage() {
  useSeoMeta({
    title: 'Your Bookmarks - Zappix',
    description: 'View your saved image posts on Zappix.',
  });

  return (
    <MainLayout key="bookmarks-layout">
      <BookmarksContent />
    </MainLayout>
  );
}