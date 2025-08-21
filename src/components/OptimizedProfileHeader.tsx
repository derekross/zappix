import { useState, useEffect, useMemo } from 'react';
import { Settings, User, Globe, Mail, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OptimizedAvatar } from "./OptimizedAvatar";
import { genUserName } from "@/lib/genUserName";

interface OptimizedProfileHeaderProps {
  user: { pubkey: string };
  metadata?: {
    name?: string;
    picture?: string;
    banner?: string;
    about?: string;
    website?: string;
    nip05?: string;
    lud16?: string;
  };
  onEditClick?: () => void;
  isLoading?: boolean;
}

// Skeleton component for loading state
function ProfileHeaderSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {/* Banner skeleton */}
        <div className="h-32 bg-gray-200 rounded-lg animate-pulse" />
        
        {/* Avatar and basic info skeleton */}
        <div className="flex items-start space-x-4 -mt-16">
          <div className="h-20 w-20 bg-gray-200 rounded-full animate-pulse ring-4 ring-white" />
          <div className="flex-1 space-y-2 pt-4">
            <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
          </div>
          <div className="h-10 bg-gray-200 rounded w-20 animate-pulse" />
        </div>

        {/* Stats skeleton */}
        <div className="flex space-x-6 pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center space-y-1">
              <div className="h-6 bg-gray-200 rounded w-12 animate-pulse mx-auto" />
              <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
            </div>
          ))}
        </div>

        {/* About skeleton */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

export function OptimizedProfileHeader({ 
  user, 
  metadata, 
  onEditClick, 
  isLoading = false 
}: OptimizedProfileHeaderProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Memoize expensive calculations
  const displayName = useMemo(() => {
    return metadata?.name ?? genUserName(user.pubkey);
  }, [metadata?.name, user.pubkey]);

  const profileImage = useMemo(() => {
    return metadata?.picture;
  }, [metadata?.picture]);

  const bannerImage = useMemo(() => {
    return metadata?.banner;
  }, [metadata?.banner]);

  const websiteUrl = useMemo(() => {
    if (!metadata?.website) return null;
    try {
      const url = metadata.website.startsWith('http') 
        ? metadata.website 
        : `https://${metadata.website}`;
      return new URL(url);
    } catch {
      return null;
    }
  }, [metadata?.website]);

  const nip05Value = useMemo(() => {
    if (!metadata?.nip05) return null;
    const [name, domain] = metadata.nip05.split('@');
    return domain ? { name, domain } : null;
  }, [metadata?.nip05]);

  // Reset image state when metadata changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [bannerImage]);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  // Show skeleton while loading
  if (isLoading) {
    return <ProfileHeaderSkeleton />;
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {/* Banner with optimized loading */}
        {bannerImage && !imageError && (
          <div className="relative h-32 overflow-hidden rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
            {imageLoaded && (
              <img
                src={bannerImage}
                alt={`${displayName}'s banner`}
                className="w-full h-full object-cover"
                onLoad={handleImageLoad}
                onError={handleImageError}
                loading="lazy"
                decoding="async"
              />
            )}
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        )}

        {/* Main profile info */}
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 -mt-16">
            {/* Optimized Avatar */}
            <div className="relative">
              <OptimizedAvatar
                pubkey={user.pubkey}
                className="h-20 w-20 ring-4 ring-white border-2 border-gray-200"
                priority={true} // High priority for profile avatar
              />
              <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 rounded-full flex items-center justify-center ring-2 ring-white">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
            </div>

            <div className="flex-1 space-y-1 pt-4">
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold">{displayName}</h1>
                <Badge variant="secondary" className="text-xs">
                  Verified
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {user.pubkey.slice(0, 16)}...
              </p>
            </div>
          </div>

          <Button 
            onClick={onEditClick}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>Edit Profile</span>
          </Button>
        </div>

        {/* Contact Information */}
        <div className="flex flex-wrap gap-4 text-sm">
          {metadata?.lud16 && (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="font-mono">{metadata.lud16}</span>
            </div>
          )}
          
          {nip05Value && (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{nip05Value.name}@{nip05Value.domain}</span>
            </div>
          )}
          
          {websiteUrl && (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Globe className="h-4 w-4" />
              <a 
                href={websiteUrl.toString()} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                {websiteUrl.hostname}
              </a>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex space-x-6 pt-4 border-t">
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold">0</div>
            <div className="text-sm text-muted-foreground">Posts</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold">0</div>
            <div className="text-sm text-muted-foreground">Following</div>
          </div>
          <div className="text-center space-y-1">
            <div className="text-2xl font-bold">0</div>
            <div className="text-sm text-muted-foreground">Followers</div>
          </div>
        </div>

        {/* About Section */}
        {metadata?.about && (
          <div className="space-y-2 pt-4 border-t">
            <h3 className="text-lg font-semibold">About</h3>
            <p className="text-muted-foreground leading-relaxed">
              {metadata.about}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}