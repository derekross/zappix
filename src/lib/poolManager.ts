import { NPool, NRelay1 } from '@nostrify/nostrify';

// Centralized pool manager to prevent duplicate WebSocket connections
class PoolManager {
  private static instance: PoolManager;
  private mainPool: NPool | null = null;
  private discoveryPool: NPool | null = null;
  private outboxPool: NPool | null = null;

  private constructor() {}

  static getInstance(): PoolManager {
    if (!PoolManager.instance) {
      PoolManager.instance = new PoolManager();
    }
    return PoolManager.instance;
  }

  // Default relays for all pools
  private getDefaultRelays() {
    return [
      'wss://relay.nostr.band',
      'wss://relay.primal.net',
      'wss://relay.olas.app',
      'wss://nos.lol',
      'wss://relay.snort.social',
      'wss://purplepag.es',
      'wss://relay.damus.io',
      'wss://ditto.pub/relay',
    ];
  }

  // Get the main pool (used by NostrProvider)
  getMainPool(): NPool {
    if (!this.mainPool) {
      const relayUrls = this.getDefaultRelays();
      this.mainPool = new NPool({
        open(url: string) {
          return new NRelay1(url);
        },
        reqRouter: (filters) => {
          const relayMap = new Map<string, typeof filters>();
          for (const url of relayUrls) {
            relayMap.set(url, filters);
          }
          return relayMap;
        },
        eventRouter: () => relayUrls.slice(0, 3),
      });
    }
    return this.mainPool;
  }

  // Get discovery pool for global feeds and hashtag queries
  getDiscoveryPool(): NPool {
    if (!this.discoveryPool) {
      const relayUrls = this.getDefaultRelays();
      this.discoveryPool = new NPool({
        open(url: string) {
          return new NRelay1(url);
        },
        reqRouter: (filters) => {
          const relayMap = new Map<string, typeof filters>();
          for (const url of relayUrls) {
            relayMap.set(url, filters);
          }
          return relayMap;
        },
        eventRouter: () => relayUrls.slice(0, 3),
      });
    }
    return this.discoveryPool;
  }

  // Get outbox pool for following feeds
  getOutboxPool(): NPool {
    if (!this.outboxPool) {
      const relayUrls = this.getDefaultRelays();
      this.outboxPool = new NPool({
        open(url: string) {
          return new NRelay1(url);
        },
        reqRouter: (filters) => {
          const relayMap = new Map<string, typeof filters>();
          for (const url of relayUrls) {
            relayMap.set(url, filters);
          }
          return relayMap;
        },
        eventRouter: () => relayUrls.slice(0, 2),
      });
    }
    return this.outboxPool;
  }

  // Close all connections and reset pools
  closeAll(): void {
    if (this.mainPool) {
      // Note: NPool doesn't have a close method, but we can nullify the references
      // to allow garbage collection
      this.mainPool = null;
    }
    if (this.discoveryPool) {
      this.discoveryPool = null;
    }
    if (this.outboxPool) {
      this.outboxPool = null;
    }
  }

  // Reset all pools (useful for testing or when configuration changes)
  reset(): void {
    this.closeAll();
  }
}

export const poolManager = PoolManager.getInstance();

// Export convenience functions for backward compatibility
export function getDiscoveryPool() {
  return poolManager.getDiscoveryPool();
}

export function getOutboxPool() {
  return poolManager.getOutboxPool();
}

export function getMainPool() {
  return poolManager.getMainPool();
}