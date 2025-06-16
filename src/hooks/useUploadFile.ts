import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BlossomUploader } from '@nostrify/nostrify/uploaders';

import { useCurrentUser } from "./useCurrentUser";
import { useBlossomServers } from "./useBlossomServers";

export function useUploadFile() {
  const { user } = useCurrentUser();
  const { data: userServers } = useBlossomServers();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) {
        throw new Error('Must be logged in to upload files');
      }

      // Use user's configured servers, fallback to default servers
      const servers = userServers && userServers.length > 0 
        ? userServers 
        : [
            'https://blossom.primal.net/',
            'https://cdn.satellite.earth/',
            'https://blossom.nostr.band/',
          ];

      const uploader = new BlossomUploader({
        servers,
        signer: user.signer,
      });

      const tags = await uploader.upload(file);
      return tags;
    },
    onSuccess: () => {
      // Invalidate blossom servers query to refresh any cached data
      queryClient.invalidateQueries({ queryKey: ['blossom-servers'] });
    },
  });
}