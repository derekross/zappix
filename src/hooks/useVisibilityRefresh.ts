import { useEffect, useRef } from 'react';
import { useRefreshNotifications } from './useRefreshNotifications';

export function useVisibilityRefresh() {
  const { refreshNotifications } = useRefreshNotifications();
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    const handleVisibilityChange = () => {
      // When the page becomes visible again, refresh notifications
      // But only if it's been more than 2 minutes since the last refresh
      if (!document.hidden) {
        const now = Date.now();
        if (now - lastRefreshRef.current > 120000) { // 2 minutes
          lastRefreshRef.current = now;
          refreshNotifications();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshNotifications]);
}