import { useEffect } from 'react';
import { useRefreshNotifications } from './useRefreshNotifications';

export function useVisibilityRefresh() {
  const { refreshNotifications } = useRefreshNotifications();

  useEffect(() => {
    const handleVisibilityChange = () => {
      // When the page becomes visible again, refresh notifications
      if (!document.hidden) {
        refreshNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshNotifications]);
}