import { useNostr } from '@nostrify/react';
import { useNostrLogin } from '@nostrify/react/login';
import { useQuery } from '@tanstack/react-query';
import { NSchema as n, NostrEvent, NostrMetadata } from '@nostrify/nostrify';

export interface Account {
  id: string;
  pubkey: string;
  event?: NostrEvent;
  metadata: NostrMetadata;
}

export function useLoggedInAccounts() {
  const { nostr } = useNostr();
  const { logins, setLogin, removeLogin } = useNostrLogin();

  const { data: authors = [] } = useQuery({
    queryKey: ['logins', logins.map((l) => l.id).join(';')],
    queryFn: async ({ signal }) => {
      if (logins.length === 0) return [];

      // One batched query against the main pool covers all logged-in accounts
      const pubkeys = logins.map((l) => l.pubkey);
      const events = await nostr.query(
        [{ kinds: [0], authors: pubkeys }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) },
      );

      // Create accounts with the most recent profile for each user
      return logins.map(({ id, pubkey }): Account => {
        const userEvents = events
          .filter((e) => e.kind === 0 && e.pubkey === pubkey)
          .sort((a, b) => b.created_at - a.created_at);

        const event = userEvents[0];

        try {
          const metadata = event ? n.json().pipe(n.metadata()).parse(event.content) : {};
          return { id, pubkey, metadata, event };
        } catch {
          return { id, pubkey, metadata: {}, event };
        }
      });
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