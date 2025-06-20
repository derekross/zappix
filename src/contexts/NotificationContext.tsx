import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface NotificationContextType {
  readNotifications: Set<string>;
  clearedNotifications: Set<string>;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: (notificationIds: string[]) => void;
  clearNotification: (notificationId: string) => void;
  clearAllNotifications: (notificationIds: string[]) => void;
  isRead: (notificationId: string) => boolean;
  isCleared: (notificationId: string) => boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useCurrentUser();
  const [readNotifications, setReadNotifications] = useLocalStorage<string[]>(
    `notifications-read-${user?.pubkey || 'anonymous'}`,
    []
  );
  const [clearedNotifications, setClearedNotifications] = useLocalStorage<string[]>(
    `notifications-cleared-${user?.pubkey || 'anonymous'}`,
    []
  );
  
  const [readNotificationsSet, setReadNotificationsSet] = useState<Set<string>>(
    new Set(readNotifications)
  );
  const [clearedNotificationsSet, setClearedNotificationsSet] = useState<Set<string>>(
    new Set(clearedNotifications)
  );

  // Update the sets when localStorage changes
  useEffect(() => {
    setReadNotificationsSet(new Set(readNotifications));
  }, [readNotifications]);

  useEffect(() => {
    setClearedNotificationsSet(new Set(clearedNotifications));
  }, [clearedNotifications]);

  // Clear read and cleared notifications when user changes
  useEffect(() => {
    if (user?.pubkey) {
      const userReadNotifications = localStorage.getItem(`notifications-read-${user.pubkey}`);
      if (userReadNotifications) {
        try {
          const parsed = JSON.parse(userReadNotifications);
          setReadNotificationsSet(new Set(parsed));
        } catch {
          setReadNotificationsSet(new Set());
        }
      } else {
        setReadNotificationsSet(new Set());
      }

      const userClearedNotifications = localStorage.getItem(`notifications-cleared-${user.pubkey}`);
      if (userClearedNotifications) {
        try {
          const parsed = JSON.parse(userClearedNotifications);
          setClearedNotificationsSet(new Set(parsed));
        } catch {
          setClearedNotificationsSet(new Set());
        }
      } else {
        setClearedNotificationsSet(new Set());
      }
    } else {
      setReadNotificationsSet(new Set());
      setClearedNotificationsSet(new Set());
    }
  }, [user?.pubkey]);

  const markAsRead = (notificationId: string) => {
    if (!readNotificationsSet.has(notificationId)) {
      const newReadNotifications = [...readNotifications, notificationId];
      setReadNotifications(newReadNotifications);
      setReadNotificationsSet(new Set(newReadNotifications));
    }
  };

  const markAllAsRead = (notificationIds: string[]) => {
    const newReadNotifications = [...new Set([...readNotifications, ...notificationIds])];
    
    // Update both localStorage and state synchronously
    setReadNotifications(newReadNotifications);
    setReadNotificationsSet(new Set(newReadNotifications));
    

  };

  const clearNotification = (notificationId: string) => {
    if (!clearedNotificationsSet.has(notificationId)) {
      const newClearedNotifications = [...clearedNotifications, notificationId];
      setClearedNotifications(newClearedNotifications);
      setClearedNotificationsSet(new Set(newClearedNotifications));
    }
  };

  const clearAllNotifications = (notificationIds: string[]) => {
    const newClearedNotifications = [...new Set([...clearedNotifications, ...notificationIds])];
    
    // Update both localStorage and state synchronously
    setClearedNotifications(newClearedNotifications);
    setClearedNotificationsSet(new Set(newClearedNotifications));
    

  };

  const isRead = (notificationId: string) => {
    return readNotificationsSet.has(notificationId);
  };

  const isCleared = (notificationId: string) => {
    return clearedNotificationsSet.has(notificationId);
  };

  return (
    <NotificationContext.Provider
      value={{
        readNotifications: readNotificationsSet,
        clearedNotifications: clearedNotificationsSet,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAllNotifications,
        isRead,
        isCleared,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}