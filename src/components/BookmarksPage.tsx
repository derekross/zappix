import { useBookmarks } from "@/hooks/useBookmarks";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ImagePost } from "./ImagePost";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark } from "lucide-react";

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

export function BookmarksPage() {
  const { user } = useCurrentUser();
  const bookmarks = useBookmarks();

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
                  Start bookmarking image posts to see them here
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {bookmarks.data.map((post) => (
            <ImagePost key={post.id} event={post} />
          ))}
        </div>
      )}
    </div>
  );
}
