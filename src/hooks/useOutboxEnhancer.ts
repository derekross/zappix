import { useEffect } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { useRelayList } from './useRelayList';
import { outboxUtils } from './useOutboxModel';
import { updateCurrentUserRelayList } from '@/components/NostrProvider';

/**
 * Hook to enhance the outbox model with user-specific relay information.
 * This hook automatically caches the current user's relay list for use by the outbox model.
 */
export function useOutboxEnhancer() {
  const { user } = useCurrentUser();
  const userRelayList = useRelayList(user?.pubkey);

  // Cache the current user's relay list for the outbox model
  useEffect(() => {
    if (user?.pubkey && userRelayList.data) {
      const relayHints = {
        writeRelays: userRelayList.data.writeRelays,
        readRelays: userRelayList.data.readRelays,
      };
      
      // Cache in the general outbox model cache
      outboxUtils.setRelayHints(user.pubkey, relayHints);
      
      // Update the current user cache for immediate access by the event router
      updateCurrentUserRelayList(user.pubkey, relayHints);
      
      console.log('Updated current user relay list:', {
        pubkey: user.pubkey,
        writeRelays: relayHints.writeRelays,
        readRelays: relayHints.readRelays,
      });
    } else {
      // Clear current user cache when no user or no relay list
      updateCurrentUserRelayList(null, null);
    }
  }, [user?.pubkey, userRelayList.data]);

  return {
    userRelayList: userRelayList.data,
    isLoading: userRelayList.isLoading,
    error: userRelayList.error,
  };
}