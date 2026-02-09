import { useUserImagePosts } from '@/hooks/useUserImagePosts';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as nip19 from 'nostr-tools/nip19';
import type { NostrEvent } from '@nostrify/nostrify';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { OptimizedImage } from '@/components/OptimizedImage';

interface UserImageGridProps {
  pubkey: string;
  className?: string;
}

function ImageGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square w-full" />
      ))}
    </div>
  );
}

function ImageGridItem({ event }: { event: NostrEvent }) {
  const navigate = useNavigate();
  // Parse image URLs from imeta tags
  const imetaTags = event.tags.filter(([name]) => name === 'imeta');
  const images = imetaTags.map(tag => {
    const urlPart = tag.find(part => part.startsWith('url '));
    const url = urlPart?.replace('url ', '');
    const altPart = tag.find(part => part.startsWith('alt '));
    const alt = altPart?.replace('alt ', '');
    const dimPart = tag.find(part => part.startsWith('dim '));
    const dimensions = dimPart?.replace('dim ', '');

    // Parse dimensions to calculate aspect ratio
    let aspectRatio = 1; // Default to square
    if (dimensions) {
      const [w, h] = dimensions.split('x').map(Number);
      if (w && h && w > 0 && h > 0) {
        aspectRatio = w / h;
      }
    }

    return { url, alt, aspectRatio };
  }).filter(img => img.url);

  if (images.length === 0) return null;

  const firstImage = images[0];
  const title = event.tags.find(([name]) => name === 'title')?.[1] || '';

  // Create nevent for linking to the post
  const nevent = nip19.neventEncode({
    id: event.id,
    author: event.pubkey,
  });

  const handleClick = () => {
    // Navigate to the post page using React Router
    navigate(`/${nevent}`);
  };

  // Determine if image should use object-contain (for very non-square images)
  const isVeryNonSquare = firstImage.aspectRatio < 0.7 || firstImage.aspectRatio > 1.4;

  return (
    <div
      className="relative aspect-square overflow-hidden rounded-md cursor-pointer group"
      onClick={handleClick}
    >
      <OptimizedImage
        src={firstImage.url || ''}
        alt={firstImage.alt || title}
        preset="feedThumbnail"
        width={320}
        className="transition-transform duration-200 group-hover:scale-105"
        containerClassName="w-full h-full"
        objectFit={isVeryNonSquare ? 'contain' : 'cover'}
        responsive={false}
      />
      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 pointer-events-none" />

      {/* Multiple images indicator */}
      {images.length > 1 && (
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
          +{images.length - 1}
        </div>
      )}
    </div>
  );
}

export function UserImageGrid({ pubkey, className }: UserImageGridProps) {
  const posts = useUserImagePosts(pubkey);

  // Intersection observer for infinite scrolling
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  // Load more posts when the load more element comes into view
  useEffect(() => {
    if (inView && posts.hasNextPage && !posts.isFetchingNextPage) {
      posts.fetchNextPage();
    }
  }, [inView, posts.hasNextPage, posts.isFetchingNextPage, posts.fetchNextPage]);

  // Flatten all pages into a single array of posts and deduplicate by event ID
  const allPosts = posts.data?.pages?.flatMap(page => page.events) || [];

  // Deduplicate events by ID to prevent duplicate keys
  const uniquePosts = allPosts.reduce((acc, post) => {
    if (!acc.find(p => p.id === post.id)) {
      acc.push(post);
    }
    return acc;
  }, [] as typeof allPosts);

  if (posts.isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-lg font-semibold">Images</h3>
        <ImageGridSkeleton />
      </div>
    );
  }

  if (posts.error) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-lg font-semibold">Images</h3>
        <Card className="border-dashed">
          <CardContent className="py-8 px-6 text-center">
            <p className="text-muted-foreground text-sm">
              Failed to load images. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!posts.data || uniquePosts.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-lg font-semibold">Images</h3>
        <Card className="border-dashed">
          <CardContent className="py-8 px-6 text-center">
            <p className="text-muted-foreground text-sm">
              No images found. Share some photos to see them here!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-lg font-semibold">Images</h3>

      <div className="grid grid-cols-3 gap-1">
        {uniquePosts.map((post) => (
          <ImageGridItem key={post.id} event={post} />
        ))}
      </div>

      {/* Load more trigger element */}
      {posts.hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {posts.isFetchingNextPage ? (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading more images...</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => posts.fetchNextPage()}
              disabled={!posts.hasNextPage}
            >
              Load More
            </Button>
          )}
        </div>
      )}

      {/* End of feed indicator */}
      {!posts.hasNextPage && allPosts.length > 0 && (
        <div className="text-center py-4">
          <p className="text-muted-foreground text-xs">
            All images loaded
          </p>
        </div>
      )}
    </div>
  );
}