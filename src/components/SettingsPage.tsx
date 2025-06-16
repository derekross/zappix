import { Settings, Server, Palette, Zap, Wifi } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';

import { RelayConfiguration } from './RelayConfiguration';
import { ZapConfiguration } from './ZapConfiguration';
import { BlossomConfiguration } from './BlossomConfiguration';
import { useTheme } from '@/hooks/useTheme';

export function SettingsPage() {
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  
  if (!user) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Login Required</h3>
              <p className="text-muted-foreground">
                Please log in to access settings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold flex items-center justify-center space-x-2">
          <Settings className="h-6 w-6" />
          <span>Settings</span>
        </h2>
        <p className="text-muted-foreground">
          Manage your Zappix preferences
        </p>
      </div>
      
      <Tabs defaultValue="relays" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="relays" className="flex items-center space-x-2">
            <Wifi className="h-4 w-4" />
            <span className="hidden sm:inline">Relays</span>
          </TabsTrigger>
          <TabsTrigger value="zaps" className="flex items-center space-x-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Zaps</span>
          </TabsTrigger>
          <TabsTrigger value="media" className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">Media</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center space-x-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Theme</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relays" className="space-y-6">
          <RelayConfiguration />
        </TabsContent>

        <TabsContent value="zaps" className="space-y-6">
          <ZapConfiguration />
        </TabsContent>

        <TabsContent value="media" className="space-y-6">
          <BlossomConfiguration />
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5" />
                <span>Appearance</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Theme</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    onClick={() => setTheme('light')}
                    className="justify-start"
                  >
                    ☀️ Light
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    onClick={() => setTheme('dark')}
                    className="justify-start"
                  >
                    🌙 Dark
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Color Scheme</Label>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-primary"></div>
                  <span className="text-sm">Orange & Purple</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Zappix uses a vibrant orange and purple color scheme
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}