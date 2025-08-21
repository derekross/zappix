import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuthor } from '@/hooks/useAuthor';

interface OptimizedAvatarProps {
  pubkey: string;
  className?: string;
  fallback?: string;
  priority?: boolean; // For high-priority avatars (current user, etc.)
  onLoad?: () => void;
  onError?: () => void;
}

// Predefined placeholder SVG to avoid inline generation
const PLACEHOLDER_SVG = `data:image/svg+xml;base64,${btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="20" fill="#f3f4f6"/>
    <circle cx="20" cy="16" r="6" fill="#d1d5db"/>
    <path d="M10 32 Q20 28 30 32" stroke="#d1d5db" stroke-width="3" stroke-linecap="round"/>
  </svg>`
)}`;

export function OptimizedAvatar({ 
  pubkey, 
  className, 
  fallback,
  priority = false,
  onLoad,
  onError
}: OptimizedAvatarProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver>();
  const { data: author, isLoading: authorLoading } = useAuthor(pubkey);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isVisible) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: '50px' } // Start loading 50px before visible
    );

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority, isVisible]);

  // Reset state when pubkey changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setIsVisible(priority);
  }, [pubkey, priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Get the best available image URL
  const getAvatarUrl = () => {
    if (!author) return null;
    
    // Try picture URL first (highest quality)
    if (author.picture) {
      // Add size parameter for optimization
      const url = new URL(author.picture);
      url.searchParams.set('width', '80');
      url.searchParams.set('height', '80');
      url.searchParams.set('quality', '80');
      return url.toString();
    }
    
    // Fallback to image URL
    if (author.image) {
      const url = new URL(author.image);
      url.searchParams.set('width', '80');
      url.searchParams.set('height', '80');
      url.searchParams.set('quality', '80');
      return url.toString();
    }
    
    return null;
  };

  const avatarUrl = getAvatarUrl();
  const shouldShowImage = isVisible && avatarUrl && !hasError;
  const showPlaceholder = !shouldShowImage || !isLoaded;

  // Generate initials from name or pubkey
  const getInitials = () => {
    if (author?.name) {
      return author.name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return pubkey.slice(0, 2).toUpperCase();
  };

  return (
    <div 
      ref={imgRef}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full bg-gray-100",
        "h-10 w-10", // Default size
        className
      )}
    >
      {/* Low-quality placeholder (shows immediately) */}
      {showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 text-xs font-medium">
          {authorLoading ? (
            <div className="animate-pulse">...</div>
          ) : (
            <span className="select-none">{getInitials()}</span>
          )}
        </div>
      )}

      {/* High-quality image (loads lazily) */}
      {shouldShowImage && (
        <img
          src={avatarUrl}
          alt={author?.name || pubkey}
          className={cn(
            "aspect-square h-full w-full object-cover",
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
        />
      )}

      {/* Loading state overlay */}
      {shouldShowImage && !isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50">
          <div className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
        </div>
      )}
    </div>
  );
}