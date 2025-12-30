import { useEffect } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';

/**
 * NostrSync - Syncs user's Nostr data
 *
 * This component runs globally to sync various Nostr data when the user logs in.
 * Currently syncs:
 * - NIP-65 relay list (kind 10002)
 */
export function NostrSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();

  // Safe access for relayMetadata (may be undefined in older localStorage data)
  const relayMetadataUpdatedAt = config.relayMetadata?.updatedAt ?? 0;

  useEffect(() => {
    if (!user) return;

    const syncRelaysFromNostr = async () => {
      try {
        const events = await nostr.query(
          [{ kinds: [10002], authors: [user.pubkey], limit: 1 }],
          { signal: AbortSignal.timeout(5000) }
        );

        if (events.length > 0) {
          const event = events[0];

          // Only update if the event is newer than our stored data
          if (event.created_at > relayMetadataUpdatedAt) {
            const fetchedRelays = event.tags
              .filter(([name]) => name === 'r')
              .map(([, url, marker]) => ({
                url,
                read: !marker || marker === 'read',
                write: !marker || marker === 'write',
              }))
              .filter(r => r.url); // Filter out invalid entries

            if (fetchedRelays.length > 0) {
              updateConfig((current) => ({
                ...current,
                relayMetadata: {
                  relays: fetchedRelays,
                  updatedAt: event.created_at,
                },
              }));
            }
          }
        }
      } catch (error) {
        console.error('[NostrSync] Failed to sync relays from Nostr:', error);
      }
    };

    syncRelaysFromNostr();
  }, [user, relayMetadataUpdatedAt, nostr, updateConfig]);

  return null;
}
