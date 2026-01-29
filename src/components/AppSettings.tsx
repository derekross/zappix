import { CheckCircle, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/hooks/useTheme';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AppSettings() {
  const { theme, setTheme } = useTheme();
  
  // Get version from build-time environment variable
  const currentVersion = import.meta.env.VERSION;

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
          <CardTitle className="text-lg">App Version</CardTitle>
          <CardDescription>
            Current app version and update information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium">Version</span>
                <Badge variant="outline" className="text-green-600 border-green-200 dark:text-green-400 dark:border-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {currentVersion || 'Development'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                The app automatically checks for updates in the background.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="space-y-2">
              <h4 className="font-medium">Automatic Updates</h4>
              <p className="text-sm text-muted-foreground">
                The app automatically checks for updates every hour when active. 
                You'll receive a notification when a new version is available.
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
