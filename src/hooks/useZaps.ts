import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import type { NostrEvent } from '@nostrify/nostrify';

// Validator function for NIP-57 zap receipt events
function validateZapReceiptEvent(event: NostrEvent): boolean {
  if (event.kind !== 9735) return false;

  // Must have bolt11 tag
  const bolt11Tag = event.tags.find(([name]) => name === 'bolt11');
  if (!bolt11Tag || !bolt11Tag[1]) return false;

  // Must have description tag
  const descriptionTag = event.tags.find(([name]) => name === 'description');
  if (!descriptionTag || !descriptionTag[1]) return false;

  return true;
}

export function useZaps(eventId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['zaps', eventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      const events = await nostr.query([{ 
        kinds: [9735], 
        '#e': [eventId],
        limit: 100 
      }], { signal });
      
      const validZaps = events.filter(validateZapReceiptEvent);
      
      // Parse zap amounts from bolt11 invoices
      const zapsWithAmounts = validZaps.map(zap => {
        const bolt11Tag = zap.tags.find(([name]) => name === 'bolt11');
        const bolt11 = bolt11Tag?.[1] || '';
        
        // Extract amount from bolt11 invoice (simplified parsing)
        let amount = 0;
        const amountMatch = bolt11.match(/lnbc(\d+)([munp]?)/);
        if (amountMatch) {
          const value = parseInt(amountMatch[1]);
          const unit = amountMatch[2];
          
          // Convert to millisats
          switch (unit) {
            case 'm': amount = value * 100000; break; // milli-bitcoin
            case 'u': amount = value * 100; break; // micro-bitcoin
            case 'n': amount = value * 0.1; break; // nano-bitcoin
            case 'p': amount = value * 0.0001; break; // pico-bitcoin
            default: amount = value * 100000000; break; // bitcoin
          }
        }
        
        return {
          ...zap,
          amount,
          amountSats: Math.floor(amount / 1000)
        };
      });
      
      const totalSats = zapsWithAmounts.reduce((sum, zap) => sum + zap.amountSats, 0);
      
      return {
        zaps: zapsWithAmounts.sort((a, b) => b.created_at - a.created_at),
        totalSats,
        count: zapsWithAmounts.length
      };
    },
    staleTime: 30000,
  });
}

export function useZapPost() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      authorPubkey, 
      amount, 
      comment = '' 
    }: { 
      eventId: string; 
      authorPubkey: string; 
      amount: number; // in sats
      comment?: string;
    }) => {
      if (!user?.signer) throw new Error('User not logged in');

      // Get author's profile to find lnurl
      const authorEvents = await nostr.query([{
        kinds: [0],
        authors: [authorPubkey],
        limit: 1
      }]);

      if (authorEvents.length === 0) {
        throw new Error('Author profile not found');
      }

      const profile = JSON.parse(authorEvents[0].content);
      const lnurl = profile.lud16 || profile.lud06;
      
      if (!lnurl) {
        throw new Error('Author does not have lightning address configured');
      }

      // Create zap request
      const zapRequest = await user.signer.signEvent({
        kind: 9734,
        content: comment,
        tags: [
          ['relays', 'wss://relay.nostr.band'], // TODO: Use user's relays
          ['amount', (amount * 1000).toString()], // Convert sats to millisats
          ['lnurl', lnurl],
          ['p', authorPubkey],
          ['e', eventId]
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      // TODO: Implement actual zap payment flow
      // This would involve:
      // 1. Sending zap request to LNURL callback
      // 2. Getting invoice
      // 3. Paying invoice via NWC or other wallet
      // 4. Waiting for zap receipt
      
      console.log('Zap request created:', zapRequest);
      return zapRequest;
    },
    onSuccess: (_, variables) => {
      // Invalidate zaps query to refetch
      queryClient.invalidateQueries({ queryKey: ['zaps', variables.eventId] });
    },
  });
}