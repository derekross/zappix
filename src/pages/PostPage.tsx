import { useParams, useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { nip19 } from 'nostr-tools';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { Camera, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginArea } from '@/components/auth/LoginArea';
import { ImagePost } from '@/components/ImagePost';
import { PublicUserProfilePage } from '@/components/PublicUserProfilePage';


const PostPage = () => {
  const { nip19Id } = useParams<{ nip19Id: string }>();
  const navigate = useNavigate();
  const { nostr } = useNostr();
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Default SEO meta - will be overridden for specific content types
  useSeoMeta({
    title: 'Zappix',
    description: 'View content on Zappix',
  });
  
  const decodedQuery = useQuery({
    queryKey: ['decoded', nip19Id],
    queryFn: async () => {
      if (!nip19Id) throw new Error('No ID provided');
      
      try {
        const decoded = nip19.decode(nip19Id);
        return decoded;
      } catch {
        throw new Error('Failed to decode identifier');
      }
    },
    enabled: !!nip19Id,
  });

  const postQuery = useQuery({
    queryKey: ['post', nip19Id],
    queryFn: async (c) => {
      if (!decodedQuery.data || decodedQuery.data.type !== 'nevent') {
        return null;
      }
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([{
        ids: [decodedQuery.data.data.id],
        kinds: [20],
        limit: 1
      }], { signal });
      
      return events[0] || null;
    },
    enabled: !!decodedQuery.data && decodedQuery.data.type === 'nevent',
  });
  
  // Handle different types of identifiers
  if (decodedQuery.isLoading) {
    return <div>Loading...</div>;
  }

  if (decodedQuery.error || !decodedQuery.data) {
    return <div>Invalid identifier</div>;
  }

  const decoded = decodedQuery.data;

  // If it's a profile (nprofile or npub), render the profile page
  if (decoded.type === 'nprofile') {
    return <PublicUserProfilePage pubkey={decoded.data.pubkey} />;
  }

  if (decoded.type === 'npub') {
    return <PublicUserProfilePage pubkey={decoded.data} />;
  }

  // If it's not a nevent, show error
  if (decoded.type !== 'nevent') {
    return <div>Unsupported identifier type</div>;
  }

  // Handle nevent (post) case
  const post = postQuery.data;
  const _title = post?.tags.find(([name]) => name === 'title')?.[1] || 'Image Post';
  
  if (postQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between">
            <button 
              onClick={scrollToTop}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <Camera className="h-6 w-6 text-primary" />
              <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Zappix
              </h1>
            </button>
            <LoginArea className="max-w-60" />
          </div>
        </header>
        
        <main className="container py-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
            
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
          </div>
        </main>
      </div>
    );
  }
  
  if (postQuery.error || !post) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between">
            <button 
              onClick={scrollToTop}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <Camera className="h-6 w-6 text-primary" />
              <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Zappix
              </h1>
            </button>
            <LoginArea className="max-w-60" />
          </div>
        </header>
        
        <main className="container py-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
            
            <Card className="border-dashed">
              <CardContent className="py-12 px-8 text-center">
                <div className="max-w-sm mx-auto space-y-6">
                  <p className="text-muted-foreground">
                    Post not found. It may have been deleted or the ID is invalid.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <button 
            onClick={scrollToTop}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <Camera className="h-6 w-6 text-primary" />
            <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Zappix
            </h1>
          </button>
          <LoginArea className="max-w-60" />
        </div>
      </header>
      
      <main className="container py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Feed
          </Button>
          
          <ImagePost event={post} />
        </div>
      </main>
    </div>
  );
};

export default PostPage;