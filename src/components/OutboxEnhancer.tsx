import { useOutboxEnhancer } from '@/hooks/useOutboxEnhancer';

/**
 * Component that enhances the outbox model with user-specific relay information.
 * This component should be placed inside the NostrProvider to ensure the user's
 * relay list is cached for intelligent routing.
 */
export function OutboxEnhancer() {
  useOutboxEnhancer();
  return null; // This component doesn't render anything
}