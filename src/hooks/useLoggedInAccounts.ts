import { useNostr } from '@nostrify/react';
import { useNostrLogin } from '@nostrify/react/login';
import { useQuery } from '@tanstack/react-query';
import { NSchema as n, NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import { useOutboxModel } from './useOutboxModel';

export interface Account {
  id: string;
  pubkey: string;
  event?: NostrEvent;
  metadata: NostrMetadata;
}

// Default discovery relays for profile metadata fallback
const DISCOVERY_RELAYS = [
  'wss://relay.ditto.pub',
  'wss://relay.primal.net',
  'wss://relay.olas.app',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://purplepag.es'
];

export function useLoggedInAccounts() {
  const { nostr } = useNostr();
  const { logins, setLogin, removeLogin } = useNostrLogin();
  const { routeRequest } = useOutboxModel();

  const { data: authors = [] } = useQuery({
    queryKey: ['logins', logins.map((l) => l.id).join(';')],
    queryFn: async ({ signal }) => {
      if (logins.length === 0) return [];

      try {
        // Use outbox model to route profile queries to users' write relays
        const pubkeys = logins.map(l => l.pubkey);
        const filter = { kinds: [0], authors: pubkeys };
        const relayMap = await routeRequest([filter], DISCOVERY_RELAYS);

        // Query all routed relays in parallel
        const queryPromises = Array.from(relayMap.entries()).map(async ([, filters]) => {
          try {
            const events = await nostr.query(filters, {
              signal: AbortSignal.any([signal, AbortSignal.timeout(3000)])
            });
            return events;
          } catch {
            return [];
          }
        });

        const results = await Promise.allSettled(queryPromises);
        const allEvents: NostrEvent[] = [];

        // Collect all successful results
        for (const result of results) {
          if (result.status === 'fulfilled') {
            allEvents.push(...result.value);
          }
        }

        // Create accounts with the most recent profile for each user
        return logins.map(({ id, pubkey }): Account => {
          const userEvents = allEvents
            .filter(e => e.kind === 0 && e.pubkey === pubkey)
            .sort((a, b) => b.created_at - a.created_at);

          const event = userEvents[0];

          try {
            const metadata = event ? n.json().pipe(n.metadata()).parse(event.content) : {};
            return { id, pubkey, metadata, event };
          } catch {
            return { id, pubkey, metadata: {}, event };
          }
        });
      } catch {
        // Fallback to discovery relays only
        const events = await nostr.query(
          [{ kinds: [0], authors: logins.map((l) => l.pubkey) }],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]) },
        );

        return logins.map(({ id, pubkey }): Account => {
          const event = events.find((e) => e.pubkey === pubkey);
          try {
            const metadata = event ? n.json().pipe(n.metadata()).parse(event.content) : {};
            return { id, pubkey, metadata, event };
          } catch {
            return { id, pubkey, metadata: {}, event };
          }
        });
      }
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Current user is the first login
  const currentUser: Account | undefined = (() => {
    const login = logins[0];
    if (!login) return undefined;
    const author = authors.find((a) => a.id === login.id);
    return { metadata: {}, ...author, id: login.id, pubkey: login.pubkey };
  })();

  // Other users are all logins except the current one
  const otherUsers = (authors || []).slice(1) as Account[];

  return {
    authors,
    currentUser,
    otherUsers,
    setLogin,
    removeLogin,
  };
}