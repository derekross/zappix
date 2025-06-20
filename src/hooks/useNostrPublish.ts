import { useNostr } from "@nostrify/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";
import { useRefreshNotifications } from "./useRefreshNotifications";

import type { NostrEvent } from "@nostrify/nostrify";

export function useNostrPublish(): UseMutationResult<NostrEvent> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { refreshNotifications } = useRefreshNotifications();

  return useMutation({
    mutationFn: async (t: Omit<NostrEvent, "id" | "pubkey" | "sig">) => {
      if (user) {
        const tags = t.tags ?? [];

        // Add the client tag if it doesn't exist
        if (
          location.protocol === "https:" &&
          !tags.some(([name]) => name === "client")
        ) {
          tags.push(["client", location.hostname]);
        }

        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        // The NostrProvider with outbox model will automatically route this event
        // to the user's write relays and any mentioned users' read relays
        await nostr.event(event, { signal: AbortSignal.timeout(15000) });
        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);
      console.log("Published to relays via outbox model");
      
      // Refresh notifications after publishing image/video posts
      // since these are the types that can receive notifications
      if ([20, 22, 34236].includes(data.kind)) {
        // Wait a moment for the event to propagate, then refresh notifications
        setTimeout(() => {
          refreshNotifications();
        }, 2000);
      }
    },
  });
}
