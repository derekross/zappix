import { useMemo } from 'react';
import { useNotifications } from './useNotifications';
import { useNotificationContext } from '@/contexts/NotificationContext';

export function useNotificationsWithReadStatus() {
  const { data: rawNotifications = [], ...queryState } = useNotifications();
  const { isRead, isCleared } = useNotificationContext();

  // Apply read status and filter out cleared notifications
  // Include readNotifications and clearedNotifications in dependencies to ensure fresh data
  const notificationsWithReadStatus = useMemo(() => {
    const filtered = rawNotifications.filter(notification => !isCleared(notification.id));
    const withReadStatus = filtered.map(notification => ({
      ...notification,
      read: isRead(notification.id),
    }));
    
    return withReadStatus;
  }, [rawNotifications, isRead, isCleared]);

  return {
    data: notificationsWithReadStatus,
    ...queryState,
  };
}

export function useUnreadNotificationCount() {
  const { data: notifications = [] } = useNotificationsWithReadStatus();
  
  return notifications.filter(notification => !notification.read).length;
}