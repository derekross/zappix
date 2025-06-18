import { useState } from "react";
import { useHashtagImagePosts } from "@/hooks/useImagePosts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Hash, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURED_HASHTAGS = [
  "olas",
  "olas365",
  "photography",
  "foodstr",
  "art",
  "travel",
];

interface HashtagGridProps {
  onHashtagClick: (hashtag: string) => void;
  onLocationClick?: (location: string) => void;
}

function HashtagCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 lg:pb-4">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-4 lg:h-5 lg:w-5" />
          <Skeleton className="h-5 w-20 lg:h-6 lg:w-24" />
          <Skeleton className="h-5 w-8 lg:h-6 lg:w-10 ml-auto" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-3 gap-1 lg:gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              className="aspect-square rounded-sm lg:rounded-md"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function HashtagGrid({
  onHashtagClick,
  onLocationClick: _onLocationClick,
}: HashtagGridProps) {
  const [searchInput, setSearchInput] = useState("");
  const hashtagPosts = useHashtagImagePosts(FEATURED_HASHTAGS, 3);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHashtag = searchInput.trim().replace(/^#/, "").toLowerCase();
    if (cleanHashtag) {
      onHashtagClick(cleanHashtag);
      setSearchInput("");
    }
  };

  if (hashtagPosts.isLoading) {
    return (
      <div className="space-y-6">
        {/* Search Section */}
        <Card className="border-dashed">
          <CardContent className="py-6">
            <form
              onSubmit={handleSearchSubmit}
              className="flex gap-2 max-w-md mx-auto"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for a hashtag..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={!searchInput.trim()}>
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Loading Grid */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Popular Hashtags</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {FEATURED_HASHTAGS.map((hashtag) => (
              <HashtagCardSkeleton key={hashtag} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (hashtagPosts.error) {
    return (
      <div className="space-y-6">
        {/* Search Section */}
        <Card className="border-dashed">
          <CardContent className="py-6">
            <form
              onSubmit={handleSearchSubmit}
              className="flex gap-2 max-w-md mx-auto"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search for a hashtag..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={!searchInput.trim()}>
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error State */}
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <p className="text-muted-foreground">
              Failed to load hashtag content. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card className="border-dashed">
        <CardContent className="py-6">
          <form
            onSubmit={handleSearchSubmit}
            className="flex gap-2 max-w-md mx-auto"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for a hashtag..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={!searchInput.trim()}>
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Popular Hashtags */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Popular Hashtags</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {hashtagPosts.data?.map(({ hashtag, posts }, index) => {
            // Parse first image from each post
            const images = posts
              .slice(0, 3)
              .map((post) => {
                const imetaTag = post.tags.find(([name]) => name === "imeta");
                if (!imetaTag) return null;

                const urlPart = imetaTag.find((part) =>
                  part.startsWith("url ")
                );
                const url = urlPart?.replace("url ", "");
                const title =
                  post.tags.find(([name]) => name === "title")?.[1] || "";

                return { url, title, postId: post.id };
              })
              .filter(Boolean);

            return (
              <Card
                key={hashtag}
                className="overflow-hidden cursor-pointer hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02] hover:border-primary/20 transition-all duration-200 group animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => onHashtagClick(hashtag)}
              >
                <CardHeader className="pb-3 lg:pb-4">
                  <CardTitle className="flex items-center space-x-2 text-lg lg:text-xl">
                    <Hash className="h-4 w-4 lg:h-5 lg:w-5 text-primary group-hover:text-primary/80 transition-colors" />
                    <span className="font-semibold">{hashtag}</span>
                    <Badge
                      variant="secondary"
                      className="ml-auto text-xs lg:text-sm"
                    >
                      {posts.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                  {images.length > 0 ? (
                    <div
                      className={cn(
                        "grid gap-1 lg:gap-2",
                        images.length === 1
                          ? "grid-cols-1"
                          : images.length === 2
                          ? "grid-cols-2"
                          : "grid-cols-3"
                      )}
                    >
                      {images.map((image, index) => (
                        <div
                          key={image?.postId || index}
                          className="aspect-square overflow-hidden rounded-sm lg:rounded-md"
                        >
                          {image?.url ? (
                            <img
                              src={image.url}
                              alt={image.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Hash className="h-6 w-6 lg:h-8 lg:w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-square bg-muted flex items-center justify-center rounded-sm lg:rounded-md">
                      <div className="text-center space-y-2 lg:space-y-3">
                        <Hash className="h-10 w-10 lg:h-12 lg:w-12 text-muted-foreground mx-auto" />
                        <p className="text-sm lg:text-base text-muted-foreground">
                          No posts yet
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
