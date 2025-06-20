# Notification System

This application includes a comprehensive notification system that alerts logged-in users when they receive reactions, comments, and zaps on their image and video posts.

## Features

- **Real-time Notifications**: Automatically fetches notifications for reactions (kind 7), comments (kind 1), and zaps (kind 9735) to user's image posts (kind 20) and video posts (kind 22, 34236)
- **Unread Count Badge**: Shows the number of unread notifications with a red badge
- **Responsive Design**: Different layouts for desktop and mobile
- **Persistent Read Status**: Tracks which notifications have been read using localStorage
- **Auto-mark as Read**: Automatically marks notifications as read when the notification panel is opened

## Components

### NotificationBell
The main notification component that displays a bell icon with an unread count badge.

**Props:**
- `className?: string` - Additional CSS classes
- `variant?: 'default' | 'mobile'` - Layout variant (default for desktop sidebar, mobile for mobile header)

**Usage:**
```tsx
// Desktop sidebar
<NotificationBell />

// Mobile header
<NotificationBell variant="mobile" />
```

### NotificationList
Displays the list of notifications in a scrollable container.

**Features:**
- Loading states with skeleton placeholders
- Empty state when no notifications exist
- Error handling for failed requests
- Scrollable list with up to 96px height

### NotificationItem
Individual notification item component that displays:
- User avatar with notification type icon overlay
- User display name and notification text
- Timestamp (relative time: now, 5m, 2h, 3d, 1w)
- Unread indicator badge
- Comment preview for comment notifications
- Zap amount for zap notifications

**Notification Types:**
- **Reactions**: Shows emoji or "+" with "reacted [emoji] to your post"
- **Comments**: Shows "commented on your post" with comment preview
- **Zaps**: Shows "zapped [amount] sats to your post" with amount

## Hooks

### useNotifications()
Fetches and manages notification data.

**Returns:**
```tsx
{
  data: NotificationEvent[],
  isLoading: boolean,
  error: Error | null
}
```

**Features:**
- Queries user's image/video posts (kinds 20, 22, 34236)
- Fetches reactions, comments, and zaps to those posts
- Filters out user's own interactions
- Sorts by timestamp (newest first)
- Deduplicates notifications
- Refetches every 60 seconds
- 30-second stale time

### useUnreadNotificationCount()
Returns the count of unread notifications.

**Returns:** `number`

### useNotificationContext()
Provides notification read state management.

**Returns:**
```tsx
{
  readNotifications: Set<string>,
  markAsRead: (notificationId: string) => void,
  markAllAsRead: (notificationIds: string[]) => void,
  isRead: (notificationId: string) => boolean
}
```

## Context

### NotificationProvider
Manages notification read state using localStorage with user-specific keys.

**Features:**
- Persists read status per user (`notifications-read-${pubkey}`)
- Automatically clears read state when user changes
- Provides methods to mark notifications as read

## Data Types

### NotificationEvent
```tsx
interface NotificationEvent {
  id: string;
  type: 'reaction' | 'comment' | 'zap';
  event: NostrEvent;
  targetEvent?: NostrEvent;
  read: boolean;
  created_at: number;
}
```

## Integration

The notification system is integrated into the main layout:

### Desktop
- Bell icon appears in the left sidebar between "Post" and "Discover" buttons
- Only visible when user is logged in
- Opens popover to the right of the sidebar

### Mobile
- Bell icon appears in the top-right corner of the header
- Only visible when user is logged in
- Opens popover below the header

## Navigation

Clicking on a notification item navigates to the target post using NIP-19 `nevent` encoding:
- Encodes the target event ID and author pubkey
- Navigates to `/${nevent}` route
- Marks the notification as read

## Performance

- Uses React Query for efficient caching and background updates
- Implements proper loading states and error handling
- Debounces read state updates
- Limits notification queries to recent posts (100 limit)
- Limits notification results (50 per type)

## Privacy

- Only tracks interactions on user's own posts
- Filters out user's own interactions (self-reactions, self-comments, etc.)
- Read state is stored locally and not shared with relays
- No personal data is transmitted beyond standard Nostr event queries

## Future Enhancements

Potential improvements for the notification system:

1. **Push Notifications**: Browser push notifications for real-time alerts
2. **Notification Categories**: Filter by reaction/comment/zap types
3. **Bulk Actions**: Mark all as read, delete notifications
4. **Sound Alerts**: Audio notifications for new interactions
5. **Mention Notifications**: Notifications when mentioned in posts
6. **Follow Notifications**: Alerts when someone follows the user
7. **Notification Settings**: User preferences for notification types
8. **Real-time Updates**: WebSocket connections for instant notifications