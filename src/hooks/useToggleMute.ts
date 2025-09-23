import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import { useMutedUsers } from './useMutedUsers';

export function useToggleMute() {
  const queryClient = useQueryClient();
  const { mutate: publishEvent } = useNostrPublish();
  const { user } = useCurrentUser();
  const { data: mutedUsers = [] } = useMutedUsers();

  return useMutation({
    mutationFn: async ({ pubkey, isMuted }: { pubkey: string; isMuted: boolean }) => {
      if (!user) {
        throw new Error('You must be logged in to mute users');
      }

      // Build the new muted users list
      let newMutedUsers: string[];
      if (isMuted) {
        // Remove from muted list
        newMutedUsers = mutedUsers.filter(p => p !== pubkey);
      } else {
        // Add to muted list
        newMutedUsers = [...mutedUsers, pubkey];
      }

      // Create the mute list event (kind 10000)
      const tags = newMutedUsers.map(p => ['p', p]);

      // Publish the mute list event
      await new Promise<void>((resolve, reject) => {
        publishEvent(
          {
            kind: 10000,
            content: '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (error) => reject(error),
          }
        );
      });

      return { pubkey, newMutedUsers };
    },
    onSuccess: ({ newMutedUsers }) => {
      // Invalidate queries to refetch with updated mute list
      queryClient.setQueryData(['muted-users', user?.pubkey], newMutedUsers);
      queryClient.invalidateQueries({ queryKey: ['image-posts'] });
      queryClient.invalidateQueries({ queryKey: ['video-posts'] });
      queryClient.invalidateQueries({ queryKey: ['hashtag-image-posts'] });
      queryClient.invalidateQueries({ queryKey: ['following-image-posts'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-image-posts'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-following-image-posts'] });
    },
  });
}

export function useIsMuted(pubkey: string) {
  const { data: mutedUsers = [] } = useMutedUsers();
  return mutedUsers.includes(pubkey);
}