import { Settings, Server, Zap, Wifi } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { RelayConfiguration } from './RelayConfiguration';
import { ZapConfiguration } from './ZapConfiguration';
import { BlossomConfiguration } from './BlossomConfiguration';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const { user } = useCurrentUser();
  const isMobile = useIsMobile();
  
  if (!user) {
    return (
      <Card className={cn("border-dashed", isMobile && "mx-0 rounded-none border-x-0")}>
        <CardContent className={cn("py-12 px-8 text-center", isMobile && "px-2")}>
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
        <TabsList className="grid w-full grid-cols-3">
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
      </Tabs>
    </div>
  );
}