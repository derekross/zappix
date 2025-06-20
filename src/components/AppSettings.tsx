import { Download, RefreshCw, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { useTheme } from '@/hooks/useTheme';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AppSettings() {
  const { 
    updateAvailable, 
    isUpdating, 
    updateError, 
    currentVersion,
    checkForUpdate, 
    applyUpdate 
  } = usePWAUpdate();
  
  const { theme, setTheme } = useTheme();

  const handleCheckForUpdate = async () => {
    await checkForUpdate();
  };

  const handleApplyUpdate = async () => {
    await applyUpdate();
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold flex items-center justify-center space-x-2">
          <Smartphone className="h-5 w-5" />
          <span>App Settings</span>
        </h3>
        <p className="text-muted-foreground">
          Manage app preferences and updates
        </p>
      </div>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appearance</CardTitle>
          <CardDescription>
            Customize how the app looks and feels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme-select">Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger id="theme-select">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* PWA Update Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">App Updates</CardTitle>
          <CardDescription>
            Manage Progressive Web App updates and installation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium">Update Status</span>
                {updateAvailable ? (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    <Download className="h-3 w-3 mr-1" />
                    Available
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-600 border-green-200 dark:text-green-400 dark:border-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Up to date
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {updateAvailable 
                  ? "A new version is ready to install"
                  : "You're running the latest version"
                }
              </p>
              {currentVersion && (
                <p className="text-xs text-muted-foreground">
                  Current version: {currentVersion}
                </p>
              )}
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckForUpdate}
                disabled={isUpdating}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Check for Updates
              </Button>
              
              {updateAvailable && (
                <Button
                  size="sm"
                  onClick={handleApplyUpdate}
                  disabled={isUpdating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Update Now
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {updateError && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-700 dark:text-red-300">{updateError}</span>
            </div>
          )}

          <div className="pt-4 border-t">
            <div className="space-y-2">
              <h4 className="font-medium">Automatic Updates</h4>
              <p className="text-sm text-muted-foreground">
                The app automatically checks for updates every 30 seconds when active. 
                Updates are applied immediately when available to ensure you always have the latest features and security improvements.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PWA Installation Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Progressive Web App</CardTitle>
          <CardDescription>
            Install Zappix as a native app on your device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Zappix can be installed as a Progressive Web App (PWA) for a native app experience:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Works offline with cached content</li>
              <li>• Faster loading and better performance</li>
              <li>• Native app-like experience</li>
              <li>• Automatic background updates</li>
              <li>• Push notifications (when available)</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              To install, look for the "Install" or "Add to Home Screen" option in your browser's menu.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}