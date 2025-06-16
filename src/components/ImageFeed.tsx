import { useImagePosts, useFollowingImagePosts } from '@/hooks/useImagePosts';
import { useFollowing } from '@/hooks/useFollowing';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ImagePost } from './ImagePost';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';


interface ImageFeedProps {
  feedType: 'global' | 'following';
  hashtag?: string;
}

function ImagePostSkeleton() {
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
        <div className="flex space-x-4 pt-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </Card>
  );
}

export function ImageFeed({ feedType, hashtag }: ImageFeedProps) {
  const { user } = useCurrentUser();
  const following = useFollowing();
  
  const globalPosts = useImagePosts(hashtag);
  const followingPosts = useFollowingImagePosts(following.data || []);
  
  const posts = feedType === 'following' ? followingPosts : globalPosts;
  
  if (posts.isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <ImagePostSkeleton key={i} />
        ))}
      </div>
    );
  }
  
  if (posts.error) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <p className="text-muted-foreground">
              Failed to load posts. Please try again.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!posts.data || posts.data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <p className="text-muted-foreground">
              {feedType === 'following' && (!user || following.data?.length === 0)
                ? "Follow some users to see their posts here"
                : hashtag
                ? `No posts found with #${hashtag}`
                : "No posts found. Content will appear as users publish to the network."
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {posts.data.map((post) => (
        <ImagePost key={post.id} event={post} />
      ))}
    </div>
  );
}