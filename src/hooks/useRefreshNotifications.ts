import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';

export function useRefreshNotifications() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  const refreshNotifications = () => {
    if (user?.pubkey) {
      // Invalidate all notification queries for the current user
      queryClient.invalidateQueries({ 
        queryKey: ['notifications', user.pubkey],
        exact: false // This will match all queries that start with ['notifications', user.pubkey]
      });
    }
  };

  const refreshNotificationsImmediately = async () => {
    if (user?.pubkey) {
      // Force immediate refetch
      await queryClient.refetchQueries({ 
        queryKey: ['notifications', user.pubkey],
        exact: false
      });
    }
  };

  return {
    refreshNotifications,
    refreshNotificationsImmediately,
  };
}