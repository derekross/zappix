import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NostrSigner } from '@nostrify/nostrify';

import { useCurrentUser } from "./useCurrentUser";
import { useBlossomServers } from "./useBlossomServers";

interface UploadOptions {
  onProgress?: (progress: number) => void;
  timeout?: number;
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
  options?: UploadOptions
): Promise<string[][]> {
  const timeout = options?.timeout || 300000; // 5 minutes default

  // Try servers in order, fallback to next if one fails
  for (const server of servers) {
    try {
      console.log(`Attempting upload to server: ${server}`);

      // Calculate the file hash first
      console.log('Calculating file hash...');
      const sha256 = await calculateSHA256(file);
      console.log('File SHA-256:', sha256);

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
            console.log(`Upload progress: ${progress}% (${(event.loaded / 1024 / 1024).toFixed(2)}MB / ${(event.total / 1024 / 1024).toFixed(2)}MB)`);
          }
        };

        // Success handler
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              const descriptor: BlobDescriptor = JSON.parse(xhr.responseText);
              console.log('Blossom blob descriptor:', descriptor);

              if (descriptor.url && descriptor.sha256) {
                // Verify the hash matches
                if (descriptor.sha256 !== sha256) {
                  console.warn('Server returned different hash:', descriptor.sha256, 'expected:', sha256);
                }

                // Generate NIP-94 compatible tags
                const tags: string[][] = [
                  ['url', descriptor.url],
                  ['x', descriptor.sha256],
                  ['size', descriptor.size.toString()],
                  ['m', descriptor.type || file.type || 'application/octet-stream'],
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

        console.log(`Starting Blossom upload to ${server}:`, {
          fileName: file.name,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          fileType: file.type || 'application/octet-stream',
          sha256: sha256,
          timeout: `${timeout / 1000} seconds`
        });

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
      // onProgress is passed to uploadToBlossom function
      if (!user) {
        throw new Error('Must be logged in to upload files');
      }

      console.log(`Starting upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // Use user's configured servers, fallback to default servers
      const servers = userServers && userServers.length > 0
        ? userServers
        : [
            'https://blossom.primal.net',    // Primary server
            'https://cdn.satellite.earth',   // Fallback (supports large files)
            'https://nostr.download',        // Second fallback
          ];

      console.log(`Using upload servers:`, servers);
      console.log(`User signer available:`, !!user.signer);
      console.log(`File details:`, {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });

      // Dynamic timeout based on file size: ~1MB per 3 seconds, min 2min, max 15min
      const baseMB = file.size / (1024 * 1024);
      const dynamicTimeoutMs = Math.max(120000, Math.min(900000, baseMB * 3000)); // 2min to 15min
      console.log(`Upload timeout set to ${Math.round(dynamicTimeoutMs / 1000)} seconds for ${baseMB.toFixed(1)}MB file`);

      try {
        const tags = await uploadToBlossom(file, user.signer, servers, {
          ...options,
          timeout: dynamicTimeoutMs
        });
        console.log(`Upload successful for ${file.name}:`, tags);
        return tags;
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);

        // Provide more specific error messages
        if (error instanceof Error) {
          if (error.message.includes('timeout')) {
            throw new Error(`Upload timed out after ${Math.round(dynamicTimeoutMs / 1000)} seconds. Please try with a smaller file or check your connection.`);
          } else if (error.message.includes('too large') || error.message.includes('413')) {
            throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). The server doesn't support files this large. Try compressing the video or use a smaller file.`);
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