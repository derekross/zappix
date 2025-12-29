import { Download, X, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export function PWAUpdateNotification() {
  const {
    updateAvailable,
    isUpdating,
    updateError,
    applyUpdate,
    dismissUpdate
  } = usePWAUpdate();

  // Don't show PWA update notification on native apps - they update via app store/APK
  if (Capacitor.isNativePlatform()) return null;

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Update Available
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                A new version of the app is ready to install.
              </p>
              
              {updateError && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {updateError}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={applyUpdate}
                disabled={isUpdating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3 mr-1" />
                    Update
                  </>
                )}
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={dismissUpdate}
                disabled={isUpdating}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}