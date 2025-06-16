import { useState, useEffect } from 'react';
import { Server, Plus, Trash2, Save, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlossomServers } from '@/hooks/useBlossomServers';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

export function BlossomConfiguration() {
  const { user } = useCurrentUser();
  const { data: currentServers, isLoading } = useBlossomServers();
  const { mutate: createEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [servers, setServers] = useState<string[]>([]);
  const [newServer, setNewServer] = useState('');

  // Initialize servers from current data
  useEffect(() => {
    if (currentServers) {
      setServers(currentServers);
    }
  }, [currentServers]);

  const addServer = () => {
    if (!newServer.trim()) return;

    try {
      new URL(newServer.trim());
      setServers(prev => [...prev, newServer.trim()]);
      setNewServer('');
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid server URL',
        variant: 'destructive',
      });
    }
  };

  const removeServer = (index: number) => {
    setServers(prev => prev.filter((_, i) => i !== index));
  };

  const saveServers = () => {
    if (!user) return;

    const tags = servers.map(server => ['server', server]);

    createEvent({
      kind: 10063,
      content: '',
      tags,
    }, {
      onSuccess: () => {
        toast({
          title: 'Servers updated',
          description: 'Your Blossom media servers have been saved',
        });
      },
      onError: (error) => {
        toast({
          title: 'Failed to save',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  const refreshServers = () => {
    queryClient.invalidateQueries({ queryKey: ['blossom-servers', user?.pubkey] });
    toast({
      title: 'Refreshing...',
      description: 'Checking for your Blossom server list',
    });
  };

  if (!user) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 px-8 text-center">
          <div className="max-w-sm mx-auto space-y-6">
            <Server className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Login Required</h3>
              <p className="text-muted-foreground">
                Please log in to configure Blossom servers
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>Blossom Media Servers</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>Blossom Media Servers</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshServers}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Current Servers</Label>
          {servers.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg text-center">
              No Blossom servers configured. Add servers below to enable media uploads.
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((server, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input value={server} readOnly className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeServer(index)}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-server">Add New Server</Label>
          <div className="flex space-x-2">
            <Input
              id="new-server"
              placeholder="https://blossom.example.com"
              value={newServer}
              onChange={(e) => setNewServer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addServer()}
              disabled={isPending}
            />
            <Button onClick={addServer} disabled={isPending || !newServer.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Blossom servers store your uploaded media files. You can add multiple servers for redundancy.
          </p>
        </div>

        <Button 
          onClick={saveServers} 
          disabled={isPending}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {isPending ? 'Saving...' : 'Save Server List'}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Note:</strong> This publishes a kind 10063 event with your server list.</p>
          <p>Popular Blossom servers include:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>https://blossom.primal.net/</li>
            <li>https://cdn.satellite.earth/</li>
            <li>https://blossom.band/</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}