import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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

// Cap notification arrays to prevent unbounded localStorage growth
const MAX_NOTIFICATION_IDS = 5000;
function capArray(arr: string[]): string[] {
  if (arr.length > MAX_NOTIFICATION_IDS) {
    return arr.slice(arr.length - MAX_NOTIFICATION_IDS);
  }
  return arr;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useCurrentUser();
  const currentUserRef = useRef(user?.pubkey);
  const isUpdatingRef = useRef(false);
  
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

  // Update the sets when localStorage changes, but only if we're not in the middle of an update
  // and the user hasn't changed
  useEffect(() => {
    if (!isUpdatingRef.current && currentUserRef.current === user?.pubkey) {
      setReadNotificationsSet(new Set(readNotifications));
    }
  }, [readNotifications, user?.pubkey]);

  useEffect(() => {
    if (!isUpdatingRef.current && currentUserRef.current === user?.pubkey) {
      setClearedNotificationsSet(new Set(clearedNotifications));
    }
  }, [clearedNotifications, user?.pubkey]);

  // Handle user changes - reset state and load user-specific data
  useEffect(() => {
    const newUserPubkey = user?.pubkey;
    
    // If user changed, update the ref and reset state
    if (currentUserRef.current !== newUserPubkey) {
      currentUserRef.current = newUserPubkey;
      
      if (newUserPubkey) {
        // Load user-specific data from localStorage
        const userReadKey = `notifications-read-${newUserPubkey}`;
        const userClearedKey = `notifications-cleared-${newUserPubkey}`;
        
        const userReadNotifications = localStorage.getItem(userReadKey);
        const userClearedNotifications = localStorage.getItem(userClearedKey);
        
        try {
          const readData = userReadNotifications ? JSON.parse(userReadNotifications) : [];
          const clearedData = userClearedNotifications ? JSON.parse(userClearedNotifications) : [];
          
          setReadNotificationsSet(new Set(readData));
          setClearedNotificationsSet(new Set(clearedData));
        } catch (error) {
          console.warn('Failed to parse notification data from localStorage:', error);
          setReadNotificationsSet(new Set());
          setClearedNotificationsSet(new Set());
        }
      } else {
        // No user logged in, clear state
        setReadNotificationsSet(new Set());
        setClearedNotificationsSet(new Set());
      }
    }
  }, [user?.pubkey]);

  const markAsRead = useCallback((notificationId: string) => {
    if (!readNotificationsSet.has(notificationId)) {
      isUpdatingRef.current = true;
      
      // Use functional update to avoid stale closure
      setReadNotifications((prev: string[]) => {
        const updated = [...prev, notificationId];
        setReadNotificationsSet(new Set(updated));
        return updated;
      });
      
      // Reset the updating flag after a brief delay to allow localStorage to update
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 10);
    }
  }, [readNotificationsSet, setReadNotifications]);

  const markAllAsRead = useCallback((notificationIds: string[]) => {
    const newReadNotifications = capArray([...new Set([...readNotifications, ...notificationIds])]);
    
    // Only update if there are actually new notifications to mark as read
    if (newReadNotifications.length > readNotifications.length) {
      isUpdatingRef.current = true;
      
      // Update both localStorage and state atomically
      setReadNotifications(newReadNotifications);
      setReadNotificationsSet(new Set(newReadNotifications));
      
      // Reset the updating flag after a brief delay
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 10);
    }
  }, [readNotifications, setReadNotifications]);

  const clearNotification = useCallback((notificationId: string) => {
    if (!clearedNotificationsSet.has(notificationId)) {
      isUpdatingRef.current = true;
      
      // Use functional update to avoid stale closure
      setClearedNotifications((prev: string[]) => {
        const updated = [...prev, notificationId];
        setClearedNotificationsSet(new Set(updated));
        return updated;
      });
      
      // Reset the updating flag after a brief delay
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 10);
    }
  }, [clearedNotificationsSet, setClearedNotifications]);

  const clearAllNotifications = useCallback((notificationIds: string[]) => {
    const newClearedNotifications = capArray([...new Set([...clearedNotifications, ...notificationIds])]);
    
    // Only update if there are actually new notifications to clear
    if (newClearedNotifications.length > clearedNotifications.length) {
      isUpdatingRef.current = true;
      
      // Update both localStorage and state atomically
      setClearedNotifications(newClearedNotifications);
      setClearedNotificationsSet(new Set(newClearedNotifications));
      
      // Reset the updating flag after a brief delay
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 10);
    }
  }, [clearedNotifications, setClearedNotifications]);

  const isRead = useCallback((notificationId: string) => {
    return readNotificationsSet.has(notificationId);
  }, [readNotificationsSet]);

  const isCleared = useCallback((notificationId: string) => {
    return clearedNotificationsSet.has(notificationId);
  }, [clearedNotificationsSet]);

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