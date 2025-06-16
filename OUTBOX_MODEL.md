# Outbox Model Implementation

This application implements the Nostr outbox model using NPool and NRelay from the nostrify library. The outbox model improves content discovery and reduces relay dependency by intelligently routing requests and events based on user relay preferences.

## Overview

The outbox model works on two key principles:

1. **Request Routing (Inbox)**: When querying for events, route requests to relays where the content is most likely to be found
2. **Event Routing (Outbox)**: When publishing events, route them to relays where they're most likely to be discovered

## Implementation Details

### Core Components

#### 1. NostrProvider (`src/components/NostrProvider.tsx`)
The main provider that creates an NPool instance with intelligent routing:

- **Request Router**: Routes queries based on author relay lists and mention patterns
- **Event Router**: Routes published events to appropriate relays based on mentions and user preferences
- **Relay Caching**: Caches relay lists to avoid repeated queries

#### 2. OutboxEnhancer (`src/components/OutboxEnhancer.tsx`)
A utility component that enhances the outbox model with user-specific relay information:

- Automatically caches the current user's relay list
- Runs inside the NostrProvider to ensure proper context

#### 3. useOutboxModel Hook (`src/hooks/useOutboxModel.ts`)
Provides utility functions for outbox model operations:

- `getRelayHints()`: Fetches relay preferences for a specific pubkey
- `routeRequest()`: Routes queries based on authors and mentions
- `routeEvent()`: Routes events for publishing
- `clearCache()`: Clears the relay list cache

#### 4. useOutboxEnhancer Hook (`src/hooks/useOutboxEnhancer.ts`)
Enhances the outbox model with user-specific relay information:

- Monitors the current user's relay list
- Automatically caches relay preferences for intelligent routing

### Routing Logic

#### Request Routing
When querying for events, the system:

1. **Always includes fallback relays** (main relay + preset relays)
2. **For author-based queries**: Routes to authors' write relays (where they publish)
3. **For mention queries**: Routes to mentioned users' read relays (where they check mentions)
4. **Limits relay usage** to prevent excessive connections (2-3 relays per author/mention)

#### Event Routing
When publishing events, the system:

1. **Always publishes to main relay** for reliability
2. **For events with mentions**: Also publishes to mentioned users' read relays
3. **Includes preset relays** as fallbacks
4. **Caps total relays** to prevent spam (typically 5-7 relays max)

### Relay List Management

The implementation uses NIP-65 relay lists (kind 10002) to determine user relay preferences:

- **Write relays**: Where users publish their content
- **Read relays**: Where users check for mentions and replies
- **Fallback handling**: Gracefully handles missing or invalid relay lists

### Caching Strategy

To improve performance and reduce network requests:

- **Relay lists are cached** in memory after first fetch
- **Cache is shared** across all outbox model operations
- **Cache can be cleared** manually for testing or refresh
- **Failed lookups are cached** to avoid repeated failed requests

## Usage

### Basic Usage
The outbox model is automatically enabled when using the standard app setup:

```tsx
// The NostrProvider automatically includes outbox model routing
<NostrProvider>
  <OutboxEnhancer /> {/* Enhances with user relay info */}
  <YourApp />
</NostrProvider>
```

### Publishing Events
Events are automatically routed using the outbox model:

```tsx
const { mutate: publishEvent } = useNostrPublish();

// This will automatically route to appropriate relays
publishEvent({
  kind: 1,
  content: "Hello Nostr!",
  tags: [["p", "mentioned_user_pubkey"]] // Will route to their read relays
});
```

### Querying Events
Queries are automatically routed to optimal relays:

```tsx
const { nostr } = useNostr();

// This will route to authors' write relays
const events = await nostr.query([{
  kinds: [1],
  authors: ["author1_pubkey", "author2_pubkey"],
  limit: 20
}]);
```

### Manual Outbox Operations
For advanced use cases, you can use the outbox model hooks directly:

```tsx
const { getRelayHints, routeRequest, routeEvent } = useOutboxModel();

// Get relay preferences for a user
const hints = await getRelayHints("user_pubkey");

// Manually route a request
const relayMap = await routeRequest(filters, fallbackRelays);

// Manually route an event
const relays = await routeEvent(event, userWriteRelays, fallbackRelays);
```

## Benefits

1. **Improved Content Discovery**: Content is more likely to be found by querying the right relays
2. **Reduced Relay Load**: Distributes load across multiple relays instead of hammering a single relay
3. **Better Censorship Resistance**: Content is distributed across multiple relays
4. **Faster Loading**: Queries are sent to relays most likely to have the content
5. **Automatic Fallbacks**: Always includes fallback relays for reliability

## Configuration

The outbox model can be configured through:

- **Preset Relays**: Configured in `App.tsx` as fallback relays
- **Main Relay**: Set via the app configuration
- **User Relay Lists**: Managed through NIP-65 relay list events (kind 10002)

## Error Handling

The implementation includes robust error handling:

- **Graceful Degradation**: Falls back to simple routing if outbox model fails
- **Individual Failures**: Ignores errors for individual authors/mentions
- **Timeout Protection**: Uses timeouts to prevent hanging requests
- **Cache Fallbacks**: Uses cached data when fresh lookups fail

## Performance Considerations

- **Relay Limits**: Limits the number of relays per query to prevent excessive connections
- **Caching**: Caches relay lists to avoid repeated network requests
- **Timeouts**: Uses short timeouts for relay list lookups to prevent delays
- **Async Operations**: All routing operations are asynchronous and non-blocking

## Testing

The outbox model includes comprehensive error handling and fallbacks, ensuring the application works even when:

- Relay lists are unavailable
- Network requests fail
- Invalid relay URLs are encountered
- Users don't have relay lists configured

## Future Enhancements

Potential improvements to the outbox model:

1. **Relay Performance Tracking**: Monitor relay response times and reliability
2. **Dynamic Relay Selection**: Prefer faster, more reliable relays
3. **Relay Discovery**: Automatically discover new relays from the network
4. **Advanced Caching**: Implement persistent caching with expiration
5. **Relay Health Monitoring**: Track relay uptime and connectivity