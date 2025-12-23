import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NostrSigner } from '@nostrify/nostrify';

import { useCurrentUser } from "./useCurrentUser";
import { useBlossomServers } from "./useBlossomServers";
import {
  compressVideo,
  shouldCompressVideo,
  isCompressionSupported,
  type CompressionResult
} from "@/lib/videoCompression";

interface UploadOptions {
  onProgress?: (progress: number) => void;
  timeout?: number;
  skipCompression?: boolean; // Allow skipping compression if needed
}

interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  uploaded: number;
}

// Calculate SHA-256 hash of a file
async function calculateSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function uploadToBlossom(
  file: File,
  signer: NostrSigner,
  servers: string[],
  options?: UploadOptions,
  originalFile?: File
): Promise<string[][]> {
  const timeout = options?.timeout || 300000; // 5 minutes default

  // Try servers in order, fallback to next if one fails
  for (const server of servers) {
    try {
      // Calculate the file hash first
      const sha256 = await calculateSHA256(file);

      // Create Blossom authorization event (kind 24242)
      const authEvent = await signer.signEvent({
        kind: 24242,
        content: `Upload ${file.name}`,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'upload'],
          ['x', sha256],
          ['expiration', Math.floor(Date.now() / 1000 + 3600).toString()], // 1 hour expiration
        ],
      });

      const authHeader = btoa(JSON.stringify(authEvent));

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Set timeout
        xhr.timeout = timeout;

        // Progress handler
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && options?.onProgress) {
            const progress = Math.round((event.loaded / event.total) * 100);
            options.onProgress(progress);
          }
        };

        // Success handler
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              const descriptor: BlobDescriptor = JSON.parse(xhr.responseText);

              if (descriptor.url && descriptor.sha256) {
                // Verify the hash matches
                if (descriptor.sha256 !== sha256) {
                  console.warn('Server returned different hash:', descriptor.sha256, 'expected:', sha256);
                }

                // Generate NIP-94 compatible tags
                // Use the actual uploaded file's MIME type, not the original file's type
                const finalMimeType = file.type || descriptor.type || 'application/octet-stream';
                const tags: string[][] = [
                  ['url', descriptor.url],
                  ['x', descriptor.sha256],
                  ['size', descriptor.size.toString()],
                  ['m', finalMimeType],
                ];

                // Add service tag for Blossom
                tags.push(['service', 'blossom']);

                resolve(tags);
              } else {
                reject(new Error('Invalid blob descriptor from Blossom server'));
              }
            } catch (error) {
              console.error('Failed to parse Blossom response:', xhr.responseText);
              reject(new Error(`Failed to parse server response: ${error}`));
            }
          } else if (xhr.status === 413) {
            reject(new Error('File too large for server limits'));
          } else if (xhr.status === 400) {
            reject(new Error('Invalid request - file may be corrupted'));
          } else if (xhr.status === 401 || xhr.status === 403) {
            reject(new Error('Authorization failed - please try logging in again'));
          } else {
            console.error('Blossom upload failed:', xhr.status, xhr.statusText, xhr.responseText);
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
          }
        };

        // Error handler
        xhr.onerror = () => {
          console.error('Network error during upload');
          reject(new Error('Network error during upload. Please check your connection and try again.'));
        };

        // Timeout handler
        xhr.ontimeout = () => {
          console.error(`Upload timed out after ${timeout / 1000} seconds`);
          reject(new Error(`Upload timed out after ${timeout / 1000} seconds. The file may be too large or the connection too slow.`));
        };

        // Abort handler
        xhr.onabort = () => {
          console.error('Upload was aborted');
          reject(new Error('Upload was cancelled'));
        };

        // Send request using PUT method per BUD-02
        xhr.open('PUT', `${server}/upload`);
        xhr.setRequestHeader('Authorization', `Nostr ${authHeader}`);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        // Send the raw file data, not FormData
        xhr.send(file);
      });
    } catch (error) {
      console.warn(`Upload failed for server ${server}:`, error);
      // Continue to next server if this one fails
      continue;
    }
  }

  // If we get here, all servers failed
  throw new Error('All upload servers failed. Please try again later.');
}

export function useUploadFile() {
  const { user } = useCurrentUser();
  const { data: userServers } = useBlossomServers();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, options = {} }: { file: File; options?: UploadOptions }) => {
      if (!user) {
        throw new Error('Must be logged in to upload files');
      }

      let fileToUpload = file;
      let compressionInfo: CompressionResult | null = null;

      // Check if video compression should be applied
      const isVideo = file.type.startsWith('video/');
      const shouldCompress = isVideo &&
        !options.skipCompression &&
        isCompressionSupported() &&
        await shouldCompressVideo(file);

      if (shouldCompress) {
        try {
          // Create a wrapper for progress that allocates 70% to compression, 30% to upload
          const compressionProgress = (progress: number) => {
            if (options.onProgress) {
              options.onProgress(progress * 0.7); // First 70% for compression
            }
          };

          compressionInfo = await compressVideo(file, {
            onProgress: compressionProgress
          });

          // IMPORTANT: Wait for compression to fully complete before proceeding
          fileToUpload = compressionInfo.compressedFile;

          // Update progress to show compression is complete
          if (options.onProgress) {
            options.onProgress(70); // 70% complete after compression
          }

        } catch (compressionError) {
          console.warn('Video compression failed, uploading original:', compressionError);

          // Fall back to original file if compression fails
          fileToUpload = file;
        }
      }

      // Use user's configured servers, fallback to default servers
      const servers = userServers && userServers.length > 0
        ? userServers
        : [
            'https://blossom.primal.net',    // Primary server
            'https://cdn.satellite.earth',   // Fallback (supports large files)
            'https://nostr.download',        // Second fallback
          ];

      // Dynamic timeout based on compressed file size: ~1MB per 3 seconds, min 2min, max 15min
      const baseMB = fileToUpload.size / (1024 * 1024);
      const dynamicTimeoutMs = Math.max(120000, Math.min(900000, baseMB * 3000)); // 2min to 15min

      try {
        // Create a wrapper for upload progress that accounts for compression
        const uploadProgress = (progress: number) => {
          if (options.onProgress) {
            const adjustedProgress = compressionInfo
              ? 70 + (progress * 0.3) // Last 30% for upload if compressed (70% was compression)
              : progress; // Full 100% for upload if not compressed
            options.onProgress(adjustedProgress);
          }
        };

        const tags = await uploadToBlossom(fileToUpload, user.signer, servers, {
          ...options,
          onProgress: uploadProgress,
          timeout: dynamicTimeoutMs
        }, file);

        // Add compression metadata to tags if applicable
        if (compressionInfo) {
          tags.push(['compression', 'true']);
          tags.push(['original_size', compressionInfo.originalSize.toString()]);
          tags.push(['compression_ratio', compressionInfo.compressionRatio.toFixed(3)]);
          tags.push(['original_filename', file.name]);
        }

        return tags;
      } catch (error) {
        console.error(`Upload failed for ${fileToUpload.name}:`, error);

        // Provide more specific error messages
        if (error instanceof Error) {
          if (error.message.includes('timeout')) {
            throw new Error(`Upload timed out after ${Math.round(dynamicTimeoutMs / 1000)} seconds. Please try with a smaller file or check your connection.`);
          } else if (error.message.includes('too large') || error.message.includes('413')) {
            throw new Error(`File too large (${(fileToUpload.size / 1024 / 1024).toFixed(1)}MB). The server doesn't support files this large. Try compressing the video or use a smaller file.`);
          } else if (error.message.includes('Authorization') || error.message.includes('401') || error.message.includes('403')) {
            throw new Error(`Authorization failed - please try logging in again.`);
          } else if (error.message.includes('network') || error.message.includes('fetch')) {
            throw new Error(`Network error during upload. Please check your connection and try again.`);
          } else if (error.message.includes('All upload servers failed')) {
            throw new Error(`Upload servers are currently unavailable. Please try again in a few minutes.`);
          }
        }

        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate blossom servers query to refresh any cached data
      queryClient.invalidateQueries({ queryKey: ['blossom-servers'] });
    },
  });
}