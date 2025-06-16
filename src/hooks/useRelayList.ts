import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

export interface RelayInfo {
  url: string;
  read: boolean;
  write: boolean;
}

// Validator function for NIP-65 relay list events
function validateRelayListEvent(event: NostrEvent): boolean {
  if (event.kind !== 10002) return false;

  // Must have at least one 'r' tag
  const rTags = event.tags.filter(([name]) => name === 'r');
  if (rTags.length === 0) return false;

  return true;
}

export function useRelayList(pubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['relay-list', pubkey],
    queryFn: async (c) => {
      if (!pubkey) return null;
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Get user's relay list (kind 10002)
      const relayEvents = await nostr.query([{ 
        kinds: [10002], 
        authors: [pubkey],
        limit: 1 
      }], { signal });
      
      if (relayEvents.length === 0) return null;
      
      const relayList = relayEvents[0];
      
      if (!validateRelayListEvent(relayList)) return null;
      
      // Parse relay tags
      const relays: RelayInfo[] = relayList.tags
        .filter(([name]) => name === 'r')
        .map(([, url, marker]) => {
          const read = !marker || marker === 'read';
          const write = !marker || marker === 'write';
          
          return {
            url,
            read,
            write,
          };
        })
        .filter(relay => relay.url);
      
      return {
        event: relayList,
        relays,
        readRelays: relays.filter(r => r.read).map(r => r.url),
        writeRelays: relays.filter(r => r.write).map(r => r.url),
      };
    },
    enabled: !!pubkey,
    staleTime: 300000, // 5 minutes
  });
}

export function useUpdateRelayList() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (relays: RelayInfo[]) => {
      if (!user?.signer || !user?.pubkey) throw new Error('User not logged in');

      const tags: string[][] = relays.map(relay => {
        if (relay.read && relay.write) {
          return ['r', relay.url];
        } else if (relay.read) {
          return ['r', relay.url, 'read'];
        } else if (relay.write) {
          return ['r', relay.url, 'write'];
        }
        return ['r', relay.url];
      });

      const event = await user.signer.signEvent({
        kind: 10002,
        content: '',
        tags,
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event);
      return event;
    },
    onSuccess: () => {
      // Invalidate relay list queries
      queryClient.invalidateQueries({ queryKey: ['relay-list'] });
    },
  });
}

// Hook to get write relays for a specific pubkey (for outbox model)
export function useWriteRelays(pubkey?: string) {
  const relayList = useRelayList(pubkey);
  
  return {
    ...relayList,
    data: relayList.data?.writeRelays || [],
  };
}

// Hook to get read relays for a specific pubkey (for inbox model)
export function useReadRelays(pubkey?: string) {
  const relayList = useRelayList(pubkey);
  
  return {
    ...relayList,
    data: relayList.data?.readRelays || [],
  };
}