/**
 * Image optimization utilities using wsrv.nl proxy service
 * Provides automatic resizing, format conversion, and caching
 */

interface ImageOptimizationOptions {
  /** Target width in pixels */
  width?: number;
  /** Target height in pixels */
  height?: number;
  /** Image quality (1-100) */
  quality?: number;
  /** Output format */
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
  /** Fit mode for resizing */
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  /** Enable blur effect for placeholder */
  blur?: number;
}

// Domains that should not be proxied (already optimized or incompatible)
const BYPASS_DOMAINS = [
  'wsrv.nl',
  'imageproxy',
  'localhost',
  '127.0.0.1',
  'data:',
];

/**
 * Check if URL should bypass the proxy
 */
function shouldBypassProxy(url: string): boolean {
  if (!url) return true;

  // Skip data URLs
  if (url.startsWith('data:')) return true;

  // Skip blob URLs
  if (url.startsWith('blob:')) return true;

  // Check bypass domains
  return BYPASS_DOMAINS.some(domain => url.includes(domain));
}

/**
 * Generate optimized image URL using wsrv.nl proxy
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options: ImageOptimizationOptions = {}
): string {
  if (!originalUrl || shouldBypassProxy(originalUrl)) {
    return originalUrl;
  }

  const {
    width,
    height,
    quality = 80,
    format = 'auto',
    fit = 'cover',
    blur,
  } = options;

  // Build wsrv.nl URL
  const params = new URLSearchParams();

  // Add dimensions
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());

  // Add quality
  params.set('q', quality.toString());

  // Add format (auto picks best format based on browser support)
  if (format === 'auto') {
    params.set('output', 'webp');
    params.set('af', ''); // Auto-format based on Accept header
  } else {
    params.set('output', format);
  }

  // Add fit mode
  params.set('fit', fit);

  // Add blur for placeholder generation
  if (blur) {
    params.set('blur', blur.toString());
  }

  // Encode the original URL
  const encodedUrl = encodeURIComponent(originalUrl);

  return `https://wsrv.nl/?url=${encodedUrl}&${params.toString()}`;
}

/**
 * Get srcset for responsive images
 */
export function getResponsiveSrcSet(
  originalUrl: string,
  sizes: number[] = [320, 640, 960, 1280],
  options: Omit<ImageOptimizationOptions, 'width'> = {}
): string {
  if (!originalUrl || shouldBypassProxy(originalUrl)) {
    return originalUrl;
  }

  return sizes
    .map(width => {
      const url = getOptimizedImageUrl(originalUrl, { ...options, width });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Get a low-quality placeholder URL for progressive loading
 */
export function getPlaceholderUrl(
  originalUrl: string,
  options: { width?: number; blur?: number } = {}
): string {
  const { width = 32, blur = 5 } = options;

  return getOptimizedImageUrl(originalUrl, {
    width,
    quality: 30,
    format: 'webp',
    blur,
  });
}

/**
 * Preset configurations for common use cases
 */
export const ImagePresets = {
  /** For feed thumbnails (cards, grid items) */
  feedThumbnail: {
    width: 640,
    quality: 75,
    format: 'webp' as const,
    fit: 'cover' as const,
  },

  /** For full-size images in detail view */
  fullSize: {
    width: 1280,
    quality: 85,
    format: 'webp' as const,
    fit: 'inside' as const,
  },

  /** For avatar images */
  avatar: {
    width: 128,
    height: 128,
    quality: 80,
    format: 'webp' as const,
    fit: 'cover' as const,
  },

  /** For profile banners */
  banner: {
    width: 1200,
    height: 400,
    quality: 80,
    format: 'webp' as const,
    fit: 'cover' as const,
  },

  /** Low-quality placeholder for blur effect */
  placeholder: {
    width: 32,
    quality: 30,
    format: 'webp' as const,
    fit: 'cover' as const,
    blur: 5,
  },

  /** Video thumbnail */
  videoThumbnail: {
    width: 480,
    quality: 75,
    format: 'webp' as const,
    fit: 'cover' as const,
  },
} as const;

/**
 * Get preset URL for common use cases
 */
export function getPresetUrl(
  originalUrl: string,
  preset: keyof typeof ImagePresets
): string {
  return getOptimizedImageUrl(originalUrl, ImagePresets[preset]);
}
