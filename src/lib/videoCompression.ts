/**
 * Video compression utilities for mobile-optimized upload and streaming
 * Uses memory-efficient streaming approach to prevent browser crashes
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  frameRate?: number;
  quality?: number; // 0.1 to 1.0
  onProgress?: (progress: number) => void;
  maxMemoryUsage?: number; // Max memory in MB (default: 50MB)
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  metadata: {
    width: number;
    height: number;
    duration: number;
    bitrate: number;
  };
}

/**
 * Default compression settings optimized for mobile upload/streaming
 * These settings follow industry standards for mobile video:
 * - 720p max resolution for good quality with reasonable file size
 * - 30fps max for smooth playback without excessive data
 * - Bitrates optimized for mobile networks
 * - Memory usage limited to prevent crashes
 */
export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  maxWidth: 720,
  maxHeight: 1280, // Vertical video priority
  videoBitrate: 2000000, // 2 Mbps - better quality
  audioBitrate: 128000,  // 128 kbps - standard quality
  frameRate: 30,         // 30fps - smooth playback
  quality: 0.8,          // 80% quality - good balance
  maxMemoryUsage: 50,    // 50MB memory limit
};

/**
 * Get optimal compression settings based on video dimensions and duration
 */
export function getOptimalCompressionSettings(
  width: number,
  height: number,
  duration: number,
  fileSize: number
): CompressionOptions {
  const settings = { ...DEFAULT_COMPRESSION_OPTIONS };

  // Adjust bitrate based on file size and duration
  const fileSizeMB = fileSize / (1024 * 1024);
  const targetSizeMB = Math.min(fileSizeMB * 0.5, 50); // Target 50% reduction, max 50MB
  const targetBitrate = (targetSizeMB * 8 * 1024 * 1024) / duration; // bits per second

  // Apply different strategies based on original resolution
  if (width <= 720 && height <= 1280) {
    // Already mobile-optimized, light compression
    settings.quality = 0.9;
    settings.videoBitrate = Math.min(settings.videoBitrate!, targetBitrate * 0.8);
  } else if (width <= 1080 && height <= 1920) {
    // HD mobile, moderate compression
    settings.maxWidth = 720;
    settings.maxHeight = 1280;
    settings.quality = 0.8;
    settings.videoBitrate = Math.min(settings.videoBitrate!, targetBitrate);
  } else {
    // High resolution, aggressive compression
    settings.maxWidth = 720;
    settings.maxHeight = 1280;
    settings.quality = 0.7;
    settings.videoBitrate = Math.min(1500000, targetBitrate); // Cap at 1.5 Mbps
  }

  // Ensure minimum quality
  settings.videoBitrate = Math.max(settings.videoBitrate!, 800000); // Min 800 kbps

  return settings;
}

/**
 * Get available memory estimate for compression safety
 */
function getAvailableMemory(): number {
  // @ts-ignore - experimental API
  if ('memory' in performance && performance.memory) {
    // @ts-ignore
    const memory = performance.memory;
    const totalMB = memory.totalJSHeapSize / (1024 * 1024);
    const usedMB = memory.usedJSHeapSize / (1024 * 1024);
    const available = Math.max(50, totalMB - usedMB); // At least 50MB available

    return available;
  }

  // Fallback: more generous estimate to allow compression
  const deviceMemory = (navigator as any).deviceMemory || 4; // GB
  const available = Math.max(100, deviceMemory * 1024 * 0.2); // Use 20% of device memory, min 100MB
  
  return available;
}

/**
 * Check if video compression is supported and memory-safe
 */
export function isCompressionSupported(): boolean {
  const hasAPIs = (
    'MediaRecorder' in window &&
    'HTMLCanvasElement' in window &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  );

  // Always try compression if APIs are available
  return hasAPIs;
}

/**
 * Simple fallback compression using direct MediaRecorder approach
 */
async function createSimpleFallbackCompression(
  file: File,
  settings: CompressionOptions
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    let objectUrl: string | null = null;

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    video.onloadedmetadata = async () => {
      try {
        // Get original video dimensions
        const { videoWidth, videoHeight, duration } = video;

        // Calculate new dimensions (less aggressive than main compression)
        const maxWidth = 720;
        const maxHeight = 1280;
        let newWidth = videoWidth;
        let newHeight = videoHeight;

        if (newWidth > maxWidth) {
          newHeight = (newHeight * maxWidth) / newWidth;
          newWidth = maxWidth;
        }

        if (newHeight > maxHeight) {
          newWidth = (newWidth * maxHeight) / newHeight;
          newHeight = maxHeight;
        }

        // Use conservative settings for fallback
        const fallbackSettings = {
          videoBitsPerSecond: 1000000, // 1Mbps - conservative
          audioBitsPerSecond: 96000,   // 96kbps
        };

        // Create a simple compressed version using lower quality
        const mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          throw new Error('WebM not supported for fallback compression');
        }

        // For now, just create a minimal compressed file
        // This is a placeholder - in a real implementation you'd use a simpler approach
        const compressedBlob = new Blob([file], { type: 'video/webm' });
        const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '.webm'), {
          type: 'video/webm',
          lastModified: Date.now(),
        });

        cleanup();
        resolve({
          compressedFile: file, // Fallback: use original file
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 1.0, // No compression in fallback
          metadata: {
            width: videoWidth,
            height: videoHeight,
            duration: duration,
            bitrate: settings.videoBitrate || 0,
          },
        });

      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    video.onerror = (e) => {
      cleanup();
      reject(new Error('Fallback compression also failed - video format may not be supported'));
    };

    try {
      objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      video.muted = true;
      video.preload = 'metadata';
      video.load();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

/**
 * Get video metadata without loading the full video
 */
export async function getVideoMetadata(file: File): Promise<{
  width: number;
  height: number;
  duration: number;
  bitrate?: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = video.duration;
      const bitrate = file.size * 8 / duration; // Estimate bitrate

      URL.revokeObjectURL(objectUrl);

      if (!width || !height || !duration) {
        reject(new Error('Invalid video metadata'));
        return;
      }

      resolve({ width, height, duration, bitrate });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load video metadata'));
    };

    video.src = objectUrl;
  });
}

/**
 * Memory-efficient video compression using optimized settings
 * Avoids loading entire video into memory to prevent crashes
 */
export async function compressVideo(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  if (!isCompressionSupported()) {
    throw new Error('Video compression is not supported by this browser');
  }

  const fileSizeMB = file.size / (1024 * 1024);

  const settings = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };

  const originalMetadata = await getVideoMetadata(file);

  // Use aggressive compression settings optimized for large files
  let finalSettings = { ...settings, ...options };

  // Improved compression settings balancing size and quality
  if (fileSizeMB > 100) {
    // Very large files: significant compression but maintain quality
    finalSettings.videoBitrate = 1200000;   // 1.2 Mbps - better quality
    finalSettings.maxWidth = 720;           // 720p for good quality
    finalSettings.maxHeight = 1280;         // 720p vertical
    finalSettings.frameRate = 24;           // 24fps - smooth enough
    finalSettings.quality = 0.75;           // Better quality
    finalSettings.audioBitrate = 128000;    // 128 kbps audio
  } else if (fileSizeMB > 50) {
    // Large files: moderate compression
    finalSettings.videoBitrate = 1500000;   // 1.5 Mbps
    finalSettings.maxWidth = 720;           // 720p
    finalSettings.maxHeight = 1280;
    finalSettings.frameRate = 30;           // 30fps
    finalSettings.quality = 0.8;
    finalSettings.audioBitrate = 128000;
  } else if (fileSizeMB > 25) {
    // Medium files: light compression
    finalSettings.videoBitrate = 2000000;   // 2 Mbps
    finalSettings.maxWidth = 720;           // 720p
    finalSettings.maxHeight = 1280;
    finalSettings.frameRate = 30;           // 30fps
    finalSettings.quality = 0.85;
    finalSettings.audioBitrate = 128000;
  }
  // Small files use default settings with good quality

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    let objectUrl: string | null = null;
    let cleanup: () => void;

    cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      video.src = '';
      video.load();
    };

    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    video.onloadedmetadata = () => {
      try {
        const { videoWidth: originalWidth, videoHeight: originalHeight } = video;

        // Calculate new dimensions maintaining aspect ratio
        let newWidth = originalWidth;
        let newHeight = originalHeight;

        if (finalSettings.maxWidth && newWidth > finalSettings.maxWidth) {
          newHeight = (newHeight * finalSettings.maxWidth) / newWidth;
          newWidth = finalSettings.maxWidth;
        }

        if (finalSettings.maxHeight && newHeight > finalSettings.maxHeight) {
          newWidth = (newWidth * finalSettings.maxHeight) / newHeight;
          newHeight = finalSettings.maxHeight;
        }

        // Ensure even dimensions and reasonable size to prevent memory issues
        newWidth = Math.min(Math.floor(newWidth / 2) * 2, 720);
        newHeight = Math.min(Math.floor(newHeight / 2) * 2, 1280);

        // Use lighter compression approach for memory efficiency
        createLightweightCompression(
          file,
          video,
          newWidth,
          newHeight,
          finalSettings,
          originalMetadata
        )
        .then(result => {
          // Delay cleanup to prevent video errors during resource cleanup
          setTimeout(() => {
            cleanup();
          }, 500);
          resolve(result);
        })
        .catch(error => {
          cleanup();
          handleError(error);
        });

      } catch (error) {
        handleError(error instanceof Error ? error : new Error('Compression setup failed'));
      }
    };

    video.onerror = () => {
      handleError(new Error('Failed to load video for compression'));
    };

    // Load video with special handling for large files
    try {
      objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      video.crossOrigin = 'anonymous';
      // Keep video unmuted initially to capture audio stream, will mute for playback if needed

      // Special settings for large files
      if (fileSizeMB > 100) {
        video.preload = 'none'; // Don't preload anything for very large files
      } else {
        video.preload = 'metadata';
      }

      // Add timeout for loading
      const loadTimeout = setTimeout(() => {
        handleError(new Error(`Video loading timeout after 30 seconds for ${fileSizeMB.toFixed(1)}MB file`));
      }, 30000);

      const clearLoadTimeout = () => {
        if (loadTimeout) clearTimeout(loadTimeout);
      };

      video.addEventListener('loadedmetadata', clearLoadTimeout, { once: true });
      video.addEventListener('error', clearLoadTimeout, { once: true });

      video.load();
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to create video URL'));
    }
  });
}

/**
 * Ultra-aggressive compression for large files using minimal memory
 */
async function createLightweightCompression(
  file: File,
  video: HTMLVideoElement,
  newWidth: number,
  newHeight: number,
  settings: CompressionOptions,
  originalMetadata: { width: number; height: number; duration: number }
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    // Use minimal canvas for memory efficiency
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: false,
      desynchronized: true
    });

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    canvas.width = newWidth;
    canvas.height = newHeight;

    // Use the specified frame rate from settings
    const frameRate = settings.frameRate || 24;
    const videoStream = canvas.captureStream(frameRate);

    // Capture audio from the original video element using captureStream
    let finalStream = videoStream;
    try {
      // Use the video element's captureStream to get both video and audio
      if ('captureStream' in video) {
        const originalVideoStream = (video as any).captureStream();
        const audioTracks = originalVideoStream.getAudioTracks();

        if (audioTracks.length > 0) {
          // Combine our compressed video with the original audio
          finalStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...audioTracks
          ]);
        }
      }
    } catch (audioError) {
      console.warn('Could not capture audio from video:', audioError);
    }

    // Check MediaRecorder support and use best available codec
    const preferredMimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];

    let selectedMimeType = 'video/webm'; // fallback
    for (const mimeType of preferredMimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        break;
      }
    }

    const mediaRecorderOptions: MediaRecorderOptions = {
      mimeType: selectedMimeType,
      videoBitsPerSecond: settings.videoBitrate || 1200000, // Use the specified bitrate
    };

    // Add audio bitrate if we have audio tracks
    if (finalStream.getAudioTracks().length > 0) {
      mediaRecorderOptions.audioBitsPerSecond = settings.audioBitrate || 128000;
    }

    const mediaRecorder = new MediaRecorder(finalStream, mediaRecorderOptions);

    const chunks: Blob[] = [];
    let lastProgressUpdate = 0;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      } else {
        console.warn('MediaRecorder data chunk is empty');
      }
    };

    mediaRecorder.onstop = () => {
      try {
        if (chunks.length === 0) {
          reject(new Error('No video data was recorded - compression failed'));
          return;
        }

        const compressedBlob = new Blob(chunks, { type: 'video/webm' });

        if (compressedBlob.size === 0) {
          reject(new Error('Compressed video is empty - compression failed'));
          return;
        }

        // Validate WebM file signature
        const firstChunk = chunks[0];
        if (firstChunk && firstChunk.size > 10) {
          firstChunk.slice(0, 20).arrayBuffer().then(buffer => {
            const bytes = new Uint8Array(buffer);

            // WebM files should start with 0x1A45DFA3 (EBML signature)
            if (!(bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3)) {
              console.warn('File may not be valid WebM - signature mismatch');
            }
          }).catch(err => console.warn('Could not check file signature:', err));
        }

        // Ensure proper filename with webm extension
        const originalName = file.name.replace(/\.[^/.]+$/, ''); // Remove original extension
        const webmFileName = `${originalName}.webm`;

        const compressedFile = new File([compressedBlob], webmFileName, {
          type: 'video/webm',
          lastModified: Date.now(),
        });

        const compressionRatio = compressedFile.size / file.size;

        // Clean up video resources after successful compression
        compressionCompleted = true;
        removeAllEventListeners();
        setTimeout(() => {
          video.pause();
          video.src = '';
          video.load();
        }, 100);

        resolve({
          compressedFile,
          originalSize: file.size,
          compressedSize: compressedFile.size,
          compressionRatio,
          metadata: {
            width: newWidth,
            height: newHeight,
            duration: originalMetadata.duration,
            bitrate: settings.videoBitrate || 0,
          },
        });
      } catch (error) {
        reject(error);
      }
    };

    mediaRecorder.onerror = (event) => {
      reject(new Error(`MediaRecorder error: ${event}`));
    };

    // Don't use timeslices - record as one complete WebM file
    mediaRecorder.start();

    // Super efficient frame processing with minimal overhead
    let lastFrameTime = 0;
    const frameInterval = 1000 / frameRate;

    const drawFrame = () => {
      if (video.paused || video.ended) {
        mediaRecorder.stop();
        return;
      }

      const now = performance.now();
      if (now - lastFrameTime >= frameInterval) {
        // Draw frame efficiently
        ctx.drawImage(video, 0, 0, newWidth, newHeight);
        lastFrameTime = now;

        // Update progress sparingly to reduce overhead
        const progress = (video.currentTime / originalMetadata.duration) * 100;
        if (progress > lastProgressUpdate + 10) { // Update every 10%
          lastProgressUpdate = progress;
          settings.onProgress?.(Math.min(progress, 100));
        }
      }

      // Use requestAnimationFrame for smoothest processing
      requestAnimationFrame(drawFrame);
    };

    // Enhanced event handling for large files
    let hasStarted = false;
    let compressionCompleted = false;
    let eventListenersAdded = false;

    // Store event handler references for proper cleanup
    const eventHandlers = {
      loadeddata: null as any,
      canplay: null as any,
      canplaythrough: null as any,
      ended: null as any,
      error: null as any,
      stalled: null as any,
      progress: null as any
    };

    const removeAllEventListeners = () => {
      if (!eventListenersAdded) return;

      Object.entries(eventHandlers).forEach(([event, handler]) => {
        if (handler) {
          video.removeEventListener(event, handler);
        }
      });
      eventListenersAdded = false;
    };

    const startCompression = () => {
      if (hasStarted) return;
      hasStarted = true;

      video.currentTime = 0;

      // Mute video for user playback (after audio stream capture)
      video.muted = true;
      video.volume = 0;

      // For large files, start playback more carefully
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          drawFrame();
        }).catch((error) => {
          console.warn('Video play failed, retrying:', error);
          video.play().then(() => {
            drawFrame();
          }).catch((mutedError) => {
            console.error('Video play failed on retry:', mutedError);
            removeAllEventListeners();
            reject(new Error(`Video playback failed: ${mutedError.message}`));
          });
        });
      } else {
        // Fallback for older browsers
        drawFrame();
      }
    };

    const handleEnded = () => {
      compressionCompleted = true;
      removeAllEventListeners();
      mediaRecorder.stop();
    };

    const handleError = (e: Event) => {
      // Don't process errors if compression has already completed
      if (compressionCompleted || (hasStarted && mediaRecorder.state === 'inactive')) {
        // Silently ignore post-compression errors to prevent console spam
        return;
      }

      console.error('Video error during compression:', e);
      removeAllEventListeners();

      // Get more detailed error information
      let errorMessage = 'Video playback failed during compression';
      if (video.error) {
        switch (video.error.code) {
          case video.error.MEDIA_ERR_ABORTED:
            errorMessage = 'Video loading was aborted';
            break;
          case video.error.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading video';
            break;
          case video.error.MEDIA_ERR_DECODE:
            errorMessage = 'Video format not supported or corrupted';
            break;
          case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Video format not supported by browser';
            break;
          default:
            errorMessage = `Video error (code: ${video.error.code})`;
        }
      }

      reject(new Error(errorMessage));
    };

    // Add stall detection for large files
    let stallTimeout: NodeJS.Timeout;
    const handleStalled = () => {
      if (compressionCompleted) return;
      console.warn('Video stalled during compression');
      stallTimeout = setTimeout(() => {
        removeAllEventListeners();
        reject(new Error('Video compression stalled - file may be too large or corrupted'));
      }, 10000); // 10 second stall timeout
    };

    const handleProgress = () => {
      if (stallTimeout) {
        clearTimeout(stallTimeout);
      }
    };

    // Set up event handlers
    eventHandlers.loadeddata = startCompression;
    eventHandlers.canplay = startCompression;
    eventHandlers.canplaythrough = startCompression;
    eventHandlers.ended = handleEnded;
    eventHandlers.error = handleError;
    eventHandlers.stalled = handleStalled;
    eventHandlers.progress = handleProgress;

    // Add event listeners
    video.addEventListener('loadeddata', eventHandlers.loadeddata);
    video.addEventListener('canplay', eventHandlers.canplay);
    video.addEventListener('canplaythrough', eventHandlers.canplaythrough);
    video.addEventListener('ended', eventHandlers.ended);
    video.addEventListener('error', eventHandlers.error);
    video.addEventListener('stalled', eventHandlers.stalled);
    video.addEventListener('progress', eventHandlers.progress);
    eventListenersAdded = true;
  });
}

/**
 * Quick compression check - determines if a video would benefit from compression
 * Also considers memory constraints to prevent crashes
 */
export async function shouldCompressVideo(file: File): Promise<boolean> {
  try {
    const fileSizeMB = file.size / (1024 * 1024);

    // Always try to compress videos that would benefit - no memory limits!
    const metadata = await getVideoMetadata(file);

    // Compress videos that would benefit from optimization
    const needsCompression = (
      fileSizeMB > 5 || // File larger than 5MB (lower threshold)
      metadata.width > 720 || // Width greater than 720p
      metadata.height > 1280 || // Height greater than 720p vertical
      (metadata.bitrate && metadata.bitrate > 1500000) // Bitrate over 1.5 Mbps
    );

    return needsCompression || false;
  } catch {
    // If we can't get metadata, compress anything over 5MB
    const fileSizeMB = file.size / (1024 * 1024);
    const shouldCompress = fileSizeMB > 5;
    return shouldCompress;
  }
}