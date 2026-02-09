import { encode } from "blurhash";

/**
 * Generate blurhash for an image file
 */
export async function generateBlurhash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Resize image for faster blurhash generation
      const maxSize = 32;
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Generate blurhash
      const hash = encode(imageData.data, canvas.width, canvas.height, 4, 3);
      URL.revokeObjectURL(img.src);
      resolve(hash);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };
  });
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  thumbnail?: string;
}

/**
 * Get video metadata including dimensions and duration
 */
export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let objectUrl: string | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      video.onloadedmetadata = null;
      video.onerror = null;
      video.oncanplay = null;
    };

    const resolveOnce = (result: VideoMetadata) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    const rejectOnce = (error: Error) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(error);
    };

    try {
      objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        try {
          const width = video.videoWidth;
          const height = video.videoHeight;
          const duration = video.duration;

          if (!width || !height || width <= 0 || height <= 0) {
            rejectOnce(new Error(`Invalid video dimensions: ${width}x${height}`));
            return;
          }

          if (isNaN(duration) || duration <= 0) {
            rejectOnce(new Error(`Invalid video duration: ${duration}`));
            return;
          }

          resolveOnce({
            width,
            height,
            duration: Math.round(duration),
          });
        } catch (error) {
          rejectOnce(error instanceof Error ? error : new Error("Metadata processing failed"));
        }
      };

      video.onerror = () => {
        rejectOnce(new Error("Failed to load video file"));
      };

      video.oncanplay = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0 && video.duration > 0) {
          setTimeout(() => {
            if (!resolved) {
              resolveOnce({
                width: video.videoWidth,
                height: video.videoHeight,
                duration: Math.round(video.duration),
              });
            }
          }, 100);
        }
      };

      timeoutId = setTimeout(() => {
        rejectOnce(new Error("Video metadata loading timeout - please try a different video file"));
      }, 15000);

      video.load();
    } catch (error) {
      rejectOnce(error instanceof Error ? error : new Error("Failed to process video file"));
    }
  });
}

/**
 * Get image dimensions from a file
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for dimensions"));
    };
    img.src = objectUrl;
  });
}

/**
 * Parse hashtags from a string
 */
export function parseHashtags(text: string): string[] {
  return text
    .split(/[,\s]+/)
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Supported video MIME types
 */
export const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/ogg",
];

/**
 * Maximum video duration in seconds (3 minutes)
 */
export const MAX_VIDEO_DURATION = 3 * 60;
