import { useState, useRef, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';
import {
  getOptimizedImageUrl,
  getPlaceholderUrl,
  getResponsiveSrcSet,
  ImagePresets,
} from '@/lib/imageOptimization';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  /** Preset configuration for common use cases */
  preset?: keyof typeof ImagePresets;
  /** Custom width override */
  width?: number;
  /** Custom height override */
  height?: number;
  /** Sizes attribute for responsive images */
  sizes?: string;
  /** Whether to use responsive srcset */
  responsive?: boolean;
  /** Priority loading (skip lazy load) */
  priority?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Object fit mode */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  /** Show loading skeleton */
  showSkeleton?: boolean;
  /** Aspect ratio for container */
  aspectRatio?: string;
}

function OptimizedImageComponent({
  src,
  alt,
  className,
  containerClassName,
  preset = 'feedThumbnail',
  width,
  height,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  responsive = true,
  priority = false,
  onClick,
  objectFit = 'cover',
  showSkeleton = true,
  aspectRatio,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get preset configuration
  const presetConfig = ImagePresets[preset];

  // Generate optimized URLs
  const optimizedSrc = getOptimizedImageUrl(src, {
    width: width || presetConfig.width,
    height: height,
    quality: presetConfig.quality,
    format: presetConfig.format,
    fit: presetConfig.fit,
  });

  const placeholderSrc = getPlaceholderUrl(src);

  const srcSet = responsive
    ? getResponsiveSrcSet(src, [320, 640, 960, 1280], {
        quality: presetConfig.quality,
        format: presetConfig.format,
        fit: presetConfig.fit,
      })
    : undefined;

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before visible
        threshold: 0.01,
      }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  // Determine object fit class
  const objectFitClass = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
    none: 'object-none',
  }[objectFit];

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-muted',
        containerClassName
      )}
      style={aspectRatio ? { aspectRatio } : undefined}
      onClick={onClick}
    >
      {/* Skeleton/Placeholder layer */}
      {showSkeleton && !isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted via-muted/80 to-muted" />
      )}

      {/* Blur placeholder - loads immediately as tiny image */}
      {isInView && !isLoaded && !hasError && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          className={cn(
            'absolute inset-0 w-full h-full blur-lg scale-110',
            objectFitClass,
            'transition-opacity duration-200'
          )}
        />
      )}

      {/* Main image */}
      {isInView && (
        <img
          ref={imgRef}
          src={optimizedSrc}
          srcSet={srcSet}
          sizes={responsive ? sizes : undefined}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full transition-opacity duration-300',
            objectFitClass,
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
        />
      )}

      {/* Error fallback */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
          <span className="text-sm">Failed to load</span>
        </div>
      )}
    </div>
  );
}

export const OptimizedImage = memo(OptimizedImageComponent);
