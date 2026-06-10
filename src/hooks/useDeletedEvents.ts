import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

interface DeletionQueryable {
  query: (filters: NostrFilter[], opts: { signal: AbortSignal }) => Promise<NostrEvent[]>;
}

/**
 * Remove events that have been deleted by their authors according to NIP-09.
 *
 * Queries deletion requests (kind 5) scoped to exactly the events passed in —
 * their ids, coordinates, and authors — instead of sampling recent deletions
 * network-wide. Per NIP-09 a deletion is only valid when its author matches
 * the deleted event's author, so the `authors` filter is both correct and
 * keeps the query small.
 *
 * Fails open: if the deletion query errors, the original events are returned
 * rather than breaking the feed.
 */
export async function filterDeletedEvents(
  events: NostrEvent[],
  pool: DeletionQueryable,
  signal: AbortSignal,
): Promise<NostrEvent[]> {
  if (events.length === 0) return events;

  const authors = [...new Set(events.map((e) => e.pubkey))];
  const ids = events.map((e) => e.id);
  const coordinates = events
    .filter((e) => e.kind >= 30000 && e.kind < 40000)
    .map((e) => `${e.kind}:${e.pubkey}:${e.tags.find(([name]) => name === 'd')?.[1] || ''}`);

  const filters: NostrFilter[] = [{ kinds: [5], authors, '#e': ids }];
  if (coordinates.length > 0) {
    filters.push({ kinds: [5], authors, '#a': coordinates });
  }

  let deletionEvents: NostrEvent[];
  try {
    deletionEvents = await pool.query(filters, { signal });
  } catch (error) {
    console.warn('Failed to fetch deletion events:', error);
    return events;
  }

  if (deletionEvents.length === 0) return events;

  // Key deletions by "<deleter>:<target>" so a third party's bogus deletion
  // can never mask or override the author's own.
  const deletedIds = new Set<string>();
  const deletedCoordinates = new Set<string>();
  for (const deletion of deletionEvents) {
    for (const [name, value] of deletion.tags) {
      if (!value) continue;
      if (name === 'e') deletedIds.add(`${deletion.pubkey}:${value}`);
      if (name === 'a') deletedCoordinates.add(`${deletion.pubkey}:${value}`);
    }
  }

  return events.filter((event) => {
    if (deletedIds.has(`${event.pubkey}:${event.id}`)) return false;
    if (event.kind >= 30000 && event.kind < 40000) {
      const dTag = event.tags.find(([name]) => name === 'd')?.[1] || '';
      const coordinate = `${event.kind}:${event.pubkey}:${dTag}`;
      if (deletedCoordinates.has(`${event.pubkey}:${coordinate}`)) return false;
    }
    return true;
  });
}
