import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationsWithReadStatus } from '@/hooks/useNotificationsWithReadStatus';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRefreshNotifications } from '@/hooks/useRefreshNotifications';
import { useQueryClient } from '@tanstack/react-query';

export function NotificationDebugger() {
  const { user } = useCurrentUser();
  const rawQuery = useNotifications();
  const processedQuery = useNotificationsWithReadStatus();
  const { refreshNotificationsImmediately } = useRefreshNotifications();
  const queryClient = useQueryClient();

  if (!user) {
    return (
      <Card className="m-4">
        <CardHeader>
          <CardTitle>Notification Debugger</CardTitle>
        </CardHeader>
        <CardContent>
          <p>No user logged in</p>
        </CardContent>
      </Card>
    );
  }

  const queryState = queryClient.getQueryState(['notifications', user.pubkey]);

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Notification Debugger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold">User</h4>
          <p className="text-sm text-muted-foreground">
            Pubkey: {user.pubkey.slice(0, 16)}...
          </p>
        </div>

        <div>
          <h4 className="font-semibold">Raw Query State</h4>
          <div className="text-sm space-y-1">
            <p>Status: {rawQuery.status}</p>
            <p>Is Loading: {rawQuery.isLoading.toString()}</p>
            <p>Is Fetching: {rawQuery.isFetching.toString()}</p>
            <p>Is Error: {rawQuery.isError.toString()}</p>
            <p>Data Length: {rawQuery.data?.length || 0}</p>
            <p>Error: {rawQuery.error?.message || 'None'}</p>
            <p>Last Updated: {queryState?.dataUpdatedAt ? new Date(queryState.dataUpdatedAt).toLocaleTimeString() : 'Never'}</p>
            <p>Fetch Status: {rawQuery.fetchStatus}</p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold">Processed Query State</h4>
          <div className="text-sm space-y-1">
            <p>Status: {processedQuery.status}</p>
            <p>Is Loading: {processedQuery.isLoading.toString()}</p>
            <p>Is Fetching: {processedQuery.isFetching.toString()}</p>
            <p>Data Length: {processedQuery.data?.length || 0}</p>
            <p>Unread Count: {processedQuery.data?.filter(n => !n.read).length || 0}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={refreshNotificationsImmediately}
            disabled={rawQuery.isFetching}
            size="sm"
          >
            Force Refresh
          </Button>
          <Button 
            onClick={() => {
              queryClient.invalidateQueries({ 
                queryKey: ['notifications', user.pubkey] 
              });
            }}
            size="sm"
            variant="outline"
          >
            Invalidate Cache
          </Button>
          <Button 
            onClick={() => {
              queryClient.removeQueries({ 
                queryKey: ['notifications', user.pubkey] 
              });
            }}
            size="sm"
            variant="destructive"
          >
            Clear Cache
          </Button>
        </div>

        {rawQuery.data && rawQuery.data.length > 0 && (
          <div>
            <h4 className="font-semibold">Recent Notifications</h4>
            <div className="text-sm space-y-1 max-h-40 overflow-y-auto">
              {rawQuery.data.slice(0, 5).map((notification, i) => (
                <div key={notification.id} className="border-l-2 border-muted pl-2">
                  <p>#{i + 1}: {notification.type} - {new Date(notification.created_at * 1000).toLocaleString()}</p>
                  <p className="text-muted-foreground">ID: {notification.id.slice(0, 16)}...</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}