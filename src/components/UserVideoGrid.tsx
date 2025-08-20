import { useUserVideoPosts } from '@/hooks/useUserVideoPosts';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as nip19 from 'nostr-tools/nip19';
import type { NostrEvent } from '@nostrify/nostrify';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';
import { Loader2, Play } from 'lucide-react';

interface UserVideoGridProps {
  pubkey: string;
  className?: string;
}

function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square w-full" />
      ))}
    </div>
  );
}

function VideoGridItem({ event }: { event: NostrEvent }) {
  const navigate = useNavigate();
  
  // Parse video URLs from imeta tags
  const imetaTags = event.tags.filter(([name]) => name === 'imeta');
  const videos = imetaTags.map(tag => {
    const urlPart = tag.find(part => part.startsWith('url '));
    const url = urlPart?.replace('url ', '');
    const mPart = tag.find(part => part.startsWith('m '));
    const mimeType = mPart?.replace('m ', '');
    const thumbPart = tag.find(part => part.startsWith('thumb '));
    const thumbnail = thumbPart?.replace('thumb ', '');
    
    return { url, mimeType, thumbnail };
  }).filter(video => video.url && video.mimeType?.startsWith('video/'));

  const primaryVideo = videos[0];
  if (!primaryVideo) return null;

  const handleClick = () => {
    const nevent = nip19.neventEncode({
      id: event.id,
      author: event.pubkey,
      kind: event.kind,
    });
    navigate(`/${nevent}`);
  };

  return (
    <div 
      className="relative aspect-square bg-muted cursor-pointer group overflow-hidden rounded-sm"
      onClick={handleClick}
    >
      {/* Video thumbnail or first frame */}
      {primaryVideo.thumbnail ? (
        <img
          src={primaryVideo.thumbnail}
          alt="Video thumbnail"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <video
          src={primaryVideo.url}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
        />
      )}
      
      {/* Play button overlay */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="bg-black/50 rounded-full p-2">
          <Play className="h-6 w-6 text-white fill-white" />
        </div>
      </div>
      
      {/* Video indicator */}
      <div className="absolute top-2 right-2">
        <div className="bg-black/50 rounded px-1.5 py-0.5">
          <Play className="h-3 w-3 text-white fill-white" />
        </div>
      </div>
    </div>
  );
}

export function UserVideoGrid({ pubkey, className }: UserVideoGridProps) {
  const query = useUserVideoPosts(pubkey);
  const navigate = useNavigate();

  // Intersection observer for infinite scrolling
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '100px',
  });

  // Load more when scrolling near bottom
  useEffect(() => {
    if (inView && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [inView, query]);

  // Flatten all pages and deduplicate
  const allVideos = query.data?.pages?.flatMap(page => page.events) || [];
  const uniqueVideos = allVideos.filter(
    (video, index, self) => index === self.findIndex(v => v.id === video.id)
  );

  if (query.isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <h3 className="text-lg font-semibold">Flix</h3>
        <VideoGridSkeleton />
      </div>
    );
  }

  if (query.error) {
    return (
      <div className={cn('space-y-4', className)}>
        <h3 className="text-lg font-semibold">Flix</h3>
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <p className="text-muted-foreground mb-4">
              Failed to load videos. Please try again.
            </p>
            <Button
              variant="outline"
              onClick={() => query.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (uniqueVideos.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <h3 className="text-lg font-semibold">Flix</h3>
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <p className="text-muted-foreground">
              No videos posted yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-lg font-semibold">Flix</h3>
      <div className="grid grid-cols-3 gap-1">
        {uniqueVideos.map((video) => (
          <VideoGridItem key={video.id} event={video} />
        ))}
      </div>
      
      {/* Load more trigger */}
      {query.hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {query.isFetchingNextPage ? (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading more videos...</span>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => query.fetchNextPage()}
              disabled={!query.hasNextPage}
            >
              Load more videos
            </Button>
          )}
        </div>
      )}
    </div>
  );
}