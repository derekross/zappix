import { useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Camera, ArrowLeft, User, Globe, Mail, CheckCircle, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginArea } from '@/components/auth/LoginArea';
import { UserImageGrid } from '@/components/UserImageGrid';
import { UserVideoGrid } from '@/components/UserVideoGrid';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsFollowing, useToggleFollow, useFollowing } from '@/hooks/useFollowing';
import { useFollowerCount } from '@/hooks/useFollowerCount';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';

function UserProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Profile Card Skeleton */}
      <Card>
        <CardHeader className="relative">
          <div className="flex items-start space-x-4">
            <Skeleton className="w-20 h-20 md:w-24 md:h-24 rounded-full" />
            <div className="flex-1 space-y-2 pt-2">
              <div className="space-y-1">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
      
      {/* Images Grid Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PublicUserProfilePageProps {
  pubkey: string;
}

export function PublicUserProfilePage({ pubkey }: PublicUserProfilePageProps) {
  const navigate = useNavigate();
  const author = useAuthor(pubkey);
  const { user: currentUser } = useCurrentUser();
  const isFollowing = useIsFollowing(pubkey);
  const { mutate: toggleFollow, isPending: isToggling } = useToggleFollow();
  const followerCount = useFollowerCount(pubkey);
  const following = useFollowing();
  const { toast } = useToast();
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFollowToggle = () => {
    if (!currentUser) {
      toast({
        title: 'Login Required',
        description: 'Please log in to follow users',
        variant: 'destructive',
      });
      return;
    }

    if (currentUser.pubkey === pubkey) {
      toast({
        title: 'Cannot Follow Yourself',
        description: 'You cannot follow your own profile',
        variant: 'destructive',
      });
      return;
    }

    const followingState = isFollowing.data || false;

    toggleFollow(
      { pubkey, isFollowing: followingState },
      {
        onSuccess: (data) => {
          toast({
            title: followingState ? 'Unfollowed' : 'Following',
            description: followingState 
              ? `You are no longer following ${displayName}`
              : `You are now following ${displayName}`,
          });
        },
        onError: (error) => {
          console.error('Follow toggle error in component:', error);
          toast({
            title: 'Error',
            description: `Failed to update follow status: ${error.message}`,
            variant: 'destructive',
          });
        },
      }
    );
  };
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(pubkey);
  const profileImage = metadata?.picture;
  const bannerImage = metadata?.banner;
  
  useSeoMeta({
    title: `${displayName} - Zappix`,
    description: metadata?.about || `View ${displayName}'s profile on Zappix`,
  });
  
  if (author.isLoading) {
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
          <div className="max-w-4xl mx-auto space-y-6">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
            
            <UserProfileSkeleton />
          </div>
        </main>
      </div>
    );
  }
  
  if (author.error) {
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
          <div className="max-w-4xl mx-auto space-y-6">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
            
            <Card className="border-dashed">
              <CardContent className="py-12 px-8 text-center">
                <div className="max-w-sm mx-auto space-y-6">
                  <User className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">
                    Profile not found or failed to load.
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
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Feed
          </Button>
          
          <div className="space-y-6">
            {/* Header with Follow Button */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold flex items-center space-x-2">
                  <User className="h-6 w-6" />
                  <span>{displayName}</span>
                </h2>
                <p className="text-muted-foreground">
                  Nostr Profile
                </p>
              </div>
              
              {/* Follow/Unfollow Button */}
              {currentUser && currentUser.pubkey !== pubkey && (
                <Button
                  onClick={handleFollowToggle}
                  disabled={isToggling || isFollowing.isLoading}
                  variant={isFollowing.data ? "outline" : "default"}
                  className={`flex items-center space-x-2 min-w-[120px] ${
                    isFollowing.data 
                      ? 'hover:bg-destructive hover:text-destructive-foreground hover:border-destructive' 
                      : ''
                  }`}
                >
                  {isToggling ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>{isFollowing.data ? 'Unfollowing...' : 'Following...'}</span>
                    </>
                  ) : isFollowing.data ? (
                    <>
                      <UserMinus className="h-4 w-4" />
                      <span>Unfollow</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Follow</span>
                    </>
                  )}
                </Button>
              )}
              
              {/* Login prompt for non-logged-in users */}
              {!currentUser && (
                <Button
                  onClick={() => {
                    toast({
                      title: 'Login Required',
                      description: 'Please log in to follow users',
                    });
                  }}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Follow</span>
                </Button>
              )}
            </div>

            {/* Profile Card */}
            <Card>
              {/* Banner */}
              {bannerImage && (
                <div className="h-32 md:h-48 overflow-hidden rounded-t-lg">
                  <img 
                    src={bannerImage} 
                    alt="Profile banner" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              <CardHeader className="relative">
                {/* Avatar */}
                <div className={`flex items-start space-x-4 ${bannerImage ? '-mt-16' : ''}`}>
                  <Avatar className={`w-20 h-20 md:w-24 md:h-24 border-4 border-background ${bannerImage ? 'relative z-10' : ''}`}>
                    <AvatarImage src={profileImage} alt={displayName} />
                    <AvatarFallback className="text-lg md:text-xl">
                      {displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 space-y-2 pt-2">
                    <div className="space-y-1">
                      <h3 className="text-xl md:text-2xl font-bold">{displayName}</h3>
                      {metadata?.display_name && metadata.display_name !== metadata.name && (
                        <p className="text-muted-foreground">@{metadata.name}</p>
                      )}
                    </div>
                    
                    {/* NIP-05 Verification */}
                    {metadata?.nip05 && (
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">{metadata.nip05}</span>
                      </div>
                    )}
                    
                    {/* Follower/Following Stats */}
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <span className="font-medium text-foreground">
                          {followerCount.data || 0}
                        </span>
                        <span>followers</span>
                      </div>
                      {currentUser?.pubkey === pubkey && (
                        <div className="flex items-center space-x-1">
                          <span className="font-medium text-foreground">
                            {following.data?.length || 0}
                          </span>
                          <span>following</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Bio */}
                {metadata?.about && (
                  <div className="space-y-2">
                    <h4 className="font-medium">About</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap break-words">
                      {metadata.about}
                    </p>
                  </div>
                )}

                {/* Website */}
                {metadata?.website && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Website</h4>
                    <a 
                      href={metadata.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 text-primary hover:underline"
                    >
                      <Globe className="h-4 w-4" />
                      <span className="break-all">{metadata.website}</span>
                    </a>
                  </div>
                )}

                {/* Lightning Address */}
                {(metadata?.lud16 || metadata?.lud06) && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Lightning Address</h4>
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="break-all font-mono text-sm">
                        {metadata.lud16 || metadata.lud06}
                      </span>
                    </div>
                  </div>
                )}

                {/* Bot Badge */}
                {metadata?.bot && (
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      🤖 Bot Account
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Content Tabs */}
            <Tabs defaultValue="pix" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pix">Pix</TabsTrigger>
                <TabsTrigger value="flix">Flix</TabsTrigger>
              </TabsList>
              
              <TabsContent value="pix" className="mt-6">
                <UserImageGrid pubkey={pubkey} />
              </TabsContent>
              
              <TabsContent value="flix" className="mt-6">
                <UserVideoGrid pubkey={pubkey} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}