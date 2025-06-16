import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { useCurrentUser } from "./useCurrentUser";
import { useNWC } from "./useNWC";
import { useLocalStorage } from "./useLocalStorage";
import type { NostrEvent } from "@nostrify/nostrify";

// Validator function for NIP-57 zap receipt events
function validateZapReceiptEvent(event: NostrEvent): boolean {
  if (event.kind !== 9735) return false;

  // Must have bolt11 tag
  const bolt11Tag = event.tags.find(([name]) => name === "bolt11");
  if (!bolt11Tag || !bolt11Tag[1]) return false;

  // Must have description tag
  const descriptionTag = event.tags.find(([name]) => name === "description");
  if (!descriptionTag || !descriptionTag[1]) return false;

  // Must have p tag (zapped author)
  const pTag = event.tags.find(([name]) => name === "p");
  if (!pTag || !pTag[1]) return false;

  // Must have e tag (zapped event)
  const eTag = event.tags.find(([name]) => name === "e");
  if (!eTag || !eTag[1]) return false;

  return true;
}

export function useZaps(eventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["zaps", eventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Query for zap receipts (9735)
      const receipts = await nostr.query(
        [
          {
            kinds: [9735],
            "#e": [eventId],
            limit: 100,
          },
        ],
        { signal }
      );

      const validZaps = receipts.filter(validateZapReceiptEvent);

      // Parse zap amounts from bolt11 invoices
      const zapsWithAmounts = validZaps.map((zap) => {
        const bolt11Tag = zap.tags.find(([name]) => name === "bolt11");
        const bolt11 = bolt11Tag?.[1] || "";
        const descriptionTag = zap.tags.find(
          ([name]) => name === "description"
        );

        // Extract amount from bolt11 invoice
        let amount = 0;
        try {
          // First try to get amount from the amount tag in the zap request
          if (descriptionTag?.[1]) {
            try {
              const zapRequest = JSON.parse(descriptionTag[1]);
              const amountTag = zapRequest.tags?.find(
                ([name]) => name === "amount"
              );
              if (amountTag?.[1]) {
                amount = parseInt(amountTag[1]);
              }
            } catch {
              // Failed to parse zap request, continue to bolt11 parsing
            }
          }

          // If no amount found in zap request, try to parse from bolt11
          if (!amount) {
            // Handle different bolt11 formats
            const amountMatch = bolt11.match(/lnbc(\d+)([munp]?)/);
            if (amountMatch) {
              const value = parseInt(amountMatch[1]);
              const unit = amountMatch[2];

              // Convert to millisats
              switch (unit) {
                case "m":
                  amount = value * 100000;
                  break; // milli-bitcoin
                case "u":
                  amount = value * 100;
                  break; // micro-bitcoin
                case "n":
                  amount = value * 0.1;
                  break; // nano-bitcoin
                case "p":
                  amount = value * 0.0001;
                  break; // pico-bitcoin
                default:
                  amount = value * 100000000;
                  break; // bitcoin
              }
            }
          }
        } catch {
          // Failed to parse amount, amount remains 0
        }

        return {
          ...zap,
          amount,
          amountSats: Math.floor(amount / 1000),
        };
      });

      const totalSats = zapsWithAmounts.reduce(
        (sum, zap) => sum + zap.amountSats,
        0
      );

      return {
        zaps: zapsWithAmounts.sort((a, b) => b.created_at - a.created_at),
        totalSats,
        count: zapsWithAmounts.length,
      };
    },
    staleTime: 30000,
  });
}

// Helper function to resolve lightning address to LNURL
async function resolveLightningAddress(address: string): Promise<string> {
  if (address.startsWith("lnurl")) {
    return address;
  }

  // Handle lightning address (user@domain.com)
  if (address.includes("@")) {
    const [username, domain] = address.split("@");
    const url = `https://${domain}/.well-known/lnurlp/${username}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      return data.callback;
    } catch {
      throw new Error("Failed to resolve lightning address");
    }
  }

  throw new Error("Invalid lightning address format");
}

// Helper function to get zap invoice from LNURL callback
async function getZapInvoice(
  callback: string,
  amount: number, // in millisats
  zapRequest: string,
  comment?: string
): Promise<string> {
  const url = new URL(callback);
  url.searchParams.set("amount", amount.toString());
  url.searchParams.set("nostr", zapRequest);
  if (comment) {
    url.searchParams.set("comment", comment);
  }

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "ERROR") {
      throw new Error(data.reason || "Failed to get invoice");
    }

    return data.pr; // The bolt11 invoice
  } catch {
    throw new Error("Failed to get zap invoice");
  }
}

export function useZapPost() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const nwc = useNWC();
  const [nwcString] = useLocalStorage("nwc-string", "");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      authorPubkey,
      amount,
      comment = "",
    }: {
      eventId: string;
      authorPubkey: string;
      amount: number; // in sats
      comment?: string;
    }) => {
      if (!user?.signer) throw new Error("User not logged in");

      // Check for NWC configuration
      if (!nwcString) {
        throw new Error(
          "No wallet configured. Please add your Nostr Wallet Connect string in settings."
        );
      }

      // Ensure NWC is connected
      if (!nwc.isConnected) {
        try {
          await nwc.connect(nwcString);
        } catch {
          throw new Error(
            "Failed to connect to wallet. Please check your connection string and try again."
          );
        }
      }

      // Get author's profile to find lightning address
      const authorEvents = await nostr.query(
        [
          {
            kinds: [0],
            authors: [authorPubkey],
            limit: 1,
          },
        ],
        { signal: AbortSignal.timeout(5000) }
      );

      if (authorEvents.length === 0) {
        throw new Error("Author profile not found");
      }

      const profile = JSON.parse(authorEvents[0].content);
      const lightningAddress = profile.lud16 || profile.lud06;

      if (!lightningAddress) {
        throw new Error("Author does not have lightning address configured");
      }

      // Create zap request event
      const zapRequest = await user.signer.signEvent({
        kind: 9734,
        content: comment,
        tags: [
          ["amount", (amount * 1000).toString()], // Convert sats to millisats
          ["lnurl", lightningAddress],
          ["p", authorPubkey],
          ["e", eventId],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      // Resolve lightning address to LNURL callback
      const callback = await resolveLightningAddress(lightningAddress);

      // Get zap invoice
      const zapRequestJson = JSON.stringify(zapRequest);
      const invoice = await getZapInvoice(
        callback,
        amount * 1000, // Convert to millisats
        zapRequestJson,
        comment
      );

      // Pay the invoice using NWC
      try {
        const preimage = await nwc.sendPayment(invoice);
        return {
          zapRequest,
          invoice,
          preimage,
          amount,
          authorPubkey,
          eventId,
        };
      } catch {
        throw new Error(
          "Failed to send payment. Please check your wallet balance and try again."
        );
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate zaps query to refetch (zap receipt should appear soon)
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["zaps", variables.eventId],
        });
      }, 2000); // Wait 2 seconds for zap receipt to propagate
    },
  });
}
