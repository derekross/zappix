import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import { useNotificationsWithReadStatus } from '@/hooks/useNotificationsWithReadStatus';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useRefreshNotifications } from '@/hooks/useRefreshNotifications';
import { useProfilePrefetch } from '@/hooks/useProfilePrefetch';
import type { NotificationEvent } from '@/hooks/useNotifications';
import { useEffect } from 'react';

interface NotificationListProps {
  notifications?: NotificationEvent[];
  isLoading?: boolean;
  error?: Error | null;
}

export function NotificationList({ 
  notifications: propNotifications, 
  isLoading: propIsLoading, 
  error: propError 
}: NotificationListProps = {}) {
  const { data: hookNotifications = [], isLoading: hookIsLoading, error: hookError, isFetching, isStale } = useNotificationsWithReadStatus();
  const { markAllAsRead, clearAllNotifications } = useNotificationContext();
  const { refreshNotificationsImmediately } = useRefreshNotifications();
  const { prefetchProfilesForNotifications } = useProfilePrefetch();
  
  // Use props if provided, otherwise use hook data
  const notifications = propNotifications ?? hookNotifications;
  const isLoading = propIsLoading ?? hookIsLoading;
  const error = propError ?? hookError;

  // Debug logging (only in development)
  if (import.meta.env.DEV) {
    console.log('NotificationList state:', {
      notifications: notifications.length,
      isLoading,
      isFetching,
      isStale,
      error: error?.message
    });
  }

  // Prefetch profiles for notification authors
  useEffect(() => {
    if (notifications.length > 0) {
      prefetchProfilesForNotifications(notifications);
    }
  }, [notifications, prefetchProfilesForNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = () => {
    const notificationIds = notifications.map(n => n.id);
    markAllAsRead(notificationIds);
  };

  const handleClearNotifications = () => {
    // Clear all notifications (remove them from the list)
    const notificationIds = notifications.map(n => n.id);
    clearAllNotifications(notificationIds);
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
        </div>
        <div className="p-4">
          <Card className="border-dashed">
            <CardContent className="py-8 px-4 text-center">
              <p className="text-muted-foreground text-sm">
                Failed to load notifications. Please try again.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="w-full">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
        </div>
        <div className="p-4">
          <Card className="border-dashed">
            <CardContent className="py-8 px-4 text-center">
              <p className="text-muted-foreground text-sm">
                No notifications yet. When people react to, comment on, or zap your posts, you'll see them here.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Notifications</h3>
              {isFetching && !isLoading && (
                <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              {unreadCount > 0 && ` • ${unreadCount} unread`}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshNotificationsImmediately}
              disabled={isFetching}
              className="text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs"
              >
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearNotifications}
                className="text-xs"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>
      </div>
      <ScrollArea className="h-96">
        <div className="p-2">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}