import { useState, useEffect } from 'react';
import { Plus, Trash2, Server, Eye, Edit, RefreshCw } from 'lucide-react';
import { useRelayList, useUpdateRelayList, type RelayInfo } from '@/hooks/useRelayList';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { outboxUtils } from '@/hooks/useOutboxModel';

export function RelayConfiguration() {
  const { user } = useCurrentUser();
  const relayList = useRelayList(user?.pubkey);
  const updateRelayList = useUpdateRelayList();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [relays, setRelays] = useState<RelayInfo[]>([]);
  
  // Update local state when query data changes
  useEffect(() => {
    if (relayList.data?.relays) {
      setRelays(relayList.data.relays);
    }
  }, [relayList.data?.relays]);
  
  const addRelay = () => {
    if (!newRelayUrl.trim()) return;
    
    let url = newRelayUrl.trim();
    
    // Add wss:// prefix if not present
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      url = 'wss://' + url;
    }
    
    // Check if relay already exists
    if (relays.some(r => r.url === url)) {
      toast({
        title: "Relay already exists",
        description: "This relay is already in your list",
        variant: "destructive",
      });
      return;
    }
    
    const newRelay: RelayInfo = {
      url,
      read: true,
      write: true,
    };
    
    setRelays([...relays, newRelay]);
    setNewRelayUrl('');
  };
  
  const removeRelay = (index: number) => {
    setRelays(relays.filter((_, i) => i !== index));
  };
  
  const updateRelay = (index: number, updates: Partial<RelayInfo>) => {
    setRelays(relays.map((relay, i) => 
      i === index ? { ...relay, ...updates } : relay
    ));
  };
  
  const saveRelayList = async () => {
    try {
      await updateRelayList.mutateAsync(relays);
      toast({
        title: "Relay list updated",
        description: "Your relay configuration has been saved",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update relay list",
        variant: "destructive",
      });
    }
  };

  const refreshRelayList = () => {
    // Clear all caches and refetch
    queryClient.invalidateQueries({ queryKey: ['relay-list', user?.pubkey] });
    outboxUtils.clearRelayCache();
    toast({
      title: "Refreshing...",
      description: "Clearing cache and checking for your relay list",
    });
  };
  
  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 px-8 text-center">
          <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Please log in to configure your relays
          </p>
        </CardContent>
      </Card>
    );
  }
  
  if (relayList.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <span>Relay Configuration (NIP-65)</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled
            >
              <RefreshCw className="h-4 w-4 animate-spin" />
            </Button>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Loading your relay configuration...
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (relayList.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <span>Relay Configuration (NIP-65)</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshRelayList}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            Failed to load your relay configuration
          </p>
          <Button onClick={refreshRelayList} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show when no relay list exists yet
  if (relayList.data === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <span>Relay Configuration (NIP-65)</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshRelayList}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure your read and write relays for the outbox model. This helps other clients find your content and deliver mentions to you.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center py-8">
            <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              No relay configuration found. Add some relays to get started.
            </p>
          </div>
          
          {/* Add New Relay */}
          <div className="space-y-2">
            <Label>Add New Relay</Label>
            <div className="flex space-x-2">
              <Input
                placeholder="wss://relay.example.com"
                value={newRelayUrl}
                onChange={(e) => setNewRelayUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRelay()}
              />
              <Button onClick={addRelay} disabled={!newRelayUrl.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          {/* Show added relays */}
          {relays.length > 0 && (
            <>
              <div className="space-y-3">
                <Label>Your Relays</Label>
                <div className="space-y-2">
                  {relays.map((relay, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium break-all">{relay.url}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          {relay.read && relay.write ? (
                            <Badge variant="secondary" className="text-xs">Read & Write</Badge>
                          ) : relay.read ? (
                            <Badge variant="outline" className="text-xs">Read Only</Badge>
                          ) : relay.write ? (
                            <Badge variant="outline" className="text-xs">Write Only</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Disabled</Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end space-x-3">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <Switch
                              checked={relay.read}
                              onCheckedChange={(checked) => updateRelay(index, { read: checked })}
                            />
                            <Eye className="h-3 w-3 text-muted-foreground" />
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <Switch
                              checked={relay.write}
                              onCheckedChange={(checked) => updateRelay(index, { write: checked })}
                            />
                            <Edit className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRelay(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={saveRelayList}
                  disabled={updateRelayList.isPending}
                  className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                >
                  {updateRelayList.isPending ? "Saving..." : "Save Relay List"}
                </Button>
              </div>
            </>
          )}
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Read relays:</strong> Where you check for mentions and replies</p>
            <p><strong>Write relays:</strong> Where you publish your content</p>
            <p><strong>Tip:</strong> Keep your relay list small (2-4 relays) for best performance</p>
          </div>
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
            <span>Relay Configuration (NIP-65)</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshRelayList}
            disabled={relayList.isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${relayList.isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure your read and write relays for the outbox model. This helps other clients find your content and deliver mentions to you.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Add New Relay */}
        <div className="space-y-2">
          <Label>Add New Relay</Label>
          <div className="flex space-x-2">
            <Input
              placeholder="wss://relay.example.com"
              value={newRelayUrl}
              onChange={(e) => setNewRelayUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRelay()}
            />
            <Button onClick={addRelay} disabled={!newRelayUrl.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </div>
        
        {/* Relay List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Your Relays</Label>
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Eye className="h-3 w-3" />
                <span>Read</span>
              </div>
              <div className="flex items-center space-x-1">
                <Edit className="h-3 w-3" />
                <span>Write</span>
              </div>
            </div>
          </div>
          
          {relays.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Server className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No relays configured. Add some relays to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {relays.map((relay, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium break-all">{relay.url}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      {relay.read && relay.write ? (
                        <Badge variant="secondary" className="text-xs">Read & Write</Badge>
                      ) : relay.read ? (
                        <Badge variant="outline" className="text-xs">Read Only</Badge>
                      ) : relay.write ? (
                        <Badge variant="outline" className="text-xs">Write Only</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Disabled</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end space-x-3">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Switch
                          checked={relay.read}
                          onCheckedChange={(checked) => updateRelay(index, { read: checked })}
                        />
                        <Eye className="h-3 w-3 text-muted-foreground" />
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Switch
                          checked={relay.write}
                          onCheckedChange={(checked) => updateRelay(index, { write: checked })}
                        />
                        <Edit className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRelay(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Save Button */}
        {relays.length > 0 && (
          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={saveRelayList}
              disabled={updateRelayList.isPending}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              {updateRelayList.isPending ? "Saving..." : "Save Relay List"}
            </Button>
          </div>
        )}
        
        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Read relays:</strong> Where you check for mentions and replies</p>
          <p><strong>Write relays:</strong> Where you publish your content</p>
          <p><strong>Tip:</strong> Keep your relay list small (2-4 relays) for best performance</p>
        </div>
      </CardContent>
    </Card>
  );
}