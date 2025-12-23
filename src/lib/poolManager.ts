import { NPool, NRelay1 } from '@nostrify/nostrify';

// Centralized pool manager to prevent duplicate WebSocket connections
// Main user queries go through NostrProvider which routes to user's NIP-65 read relays
// Discovery pool is used for global feeds, hashtag queries, and video-specific relays
class PoolManager {
  private static instance: PoolManager;
  private mainPool: NPool | null = null;
  private discoveryPool: NPool | null = null;
  private relayConnections = new Map<string, NRelay1>();

  private constructor() {}

  static getInstance(): PoolManager {
    if (!PoolManager.instance) {
      PoolManager.instance = new PoolManager();
    }
    return PoolManager.instance;
  }

  // Shared relay opener to reuse connections
  private openRelay(url: string): NRelay1 {
    let relay = this.relayConnections.get(url);
    if (!relay) {
      relay = new NRelay1(url);
      this.relayConnections.set(url, relay);
    }
    return relay;
  }

  // Optimized relays - fewer, faster relays for better performance
  private getFastRelays() {
    return [
      'wss://relay.nostr.band', // Fast indexing relay
      'wss://relay.primal.net',  // Fast caching relay
      'wss://nos.lol',          // Fast relay
    ];
  }

  // Discovery relays for global feeds - slightly more coverage
  private getDiscoveryRelays() {
    return [
      'wss://relay.nostr.band',
      'wss://relay.primal.net',
      'wss://nos.lol',
      'wss://relay.damus.io',
      // Divine relay for video content
      'wss://relay.divine.video',
    ];
  }

  // Get the main pool (used by NostrProvider) - optimized for speed
  getMainPool(): NPool {
    if (!this.mainPool) {
      const relayUrls = this.getFastRelays();
      const openRelay = this.openRelay.bind(this);
      this.mainPool = new NPool({
        open: openRelay,
        reqRouter: (filters) => {
          const relayMap = new Map<string, typeof filters>();
          for (const url of relayUrls) {
            relayMap.set(url, filters);
          }
          return relayMap;
        },
        eventRouter: () => relayUrls.slice(0, 2), // Reduced to 2 for faster publishing
      });
    }
    return this.mainPool;
  }

  // Get discovery pool for global feeds and hashtag queries
  getDiscoveryPool(): NPool {
    if (!this.discoveryPool) {
      const relayUrls = this.getDiscoveryRelays();
      const openRelay = this.openRelay.bind(this);
      this.discoveryPool = new NPool({
        open: openRelay,
        reqRouter: (filters) => {
          const relayMap = new Map<string, typeof filters>();
          // Use all discovery relays to ensure comprehensive coverage
          for (const url of relayUrls) {
            relayMap.set(url, filters);
          }
          return relayMap;
        },
        eventRouter: () => relayUrls.slice(0, 2),
      });
    }
    return this.discoveryPool;
  }

  // Close all connections and reset pools
  closeAll(): void {
    // Close all relay connections
    for (const relay of this.relayConnections.values()) {
      try {
        relay.close();
      } catch {
        // Ignore close errors
      }
    }
    this.relayConnections.clear();

    this.mainPool = null;
    this.discoveryPool = null;
  }

  // Reset all pools (useful for testing or when configuration changes)
  reset(): void {
    this.closeAll();
  }
}

export const poolManager = PoolManager.getInstance();

// Export convenience functions
export function getDiscoveryPool() {
  return poolManager.getDiscoveryPool();
}

export function getMainPool() {
  return poolManager.getMainPool();
}