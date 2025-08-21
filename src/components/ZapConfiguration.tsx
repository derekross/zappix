import { useState } from 'react';
import { Zap, Wallet, Info } from 'lucide-react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { useNWC } from '@/hooks/useNWCContext';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

export function ZapConfiguration() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const nwc = useNWC();
  const isMobile = useIsMobile();

  const [nwcString, setNwcString] = useLocalStorage('nwc-string', '');
  const [defaultZapAmount, setDefaultZapAmount] = useLocalStorage('default-zap-amount', '21');
  const [tempNwcString, setTempNwcString] = useState(nwcString);
  const [tempZapAmount, setTempZapAmount] = useState(defaultZapAmount);

  const handleSaveZapSettings = () => {
    // Validate NWC string format if provided
    if (tempNwcString && !tempNwcString.startsWith('nostrwalletconnect://') && !tempNwcString.startsWith('nostr+walletconnect://')) {
      toast({
        title: 'Invalid NWC String',
        description: 'Nostr Wallet Connect string must start with "nostrwalletconnect://" or "nostr+walletconnect://"',
        variant: 'destructive',
      });
      return;
    }

    // Validate zap amount
    const amount = parseInt(tempZapAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Default zap amount must be a positive number',
        variant: 'destructive',
      });
      return;
    }

    // Save to localStorage
    setNwcString(tempNwcString);
    setDefaultZapAmount(tempZapAmount);

    toast({
      title: 'Settings saved',
      description: 'Your zap settings have been updated',
    });
  };

  const handleReset = () => {
    setTempNwcString(nwcString);
    setTempZapAmount(defaultZapAmount);
  };

  const hasChanges = tempNwcString !== nwcString || tempZapAmount !== defaultZapAmount;

  if (!user) {
    return (
      <Card className={cn("border-dashed", isMobile && "mx-0 rounded-none border-x-0")}>
        <CardContent className={cn("py-12 px-8 text-center", isMobile && "px-2")}>
          <div className="max-w-sm mx-auto space-y-6">
            <Zap className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Login Required</h3>
              <p className="text-muted-foreground">
                Please log in to configure zap settings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className={cn(isMobile && "mx-0 rounded-none border-x-0")}>
        <CardHeader className={cn(isMobile && "px-2")}>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 text-orange-500" />
            <span>Lightning Wallet</span>
          </CardTitle>
        </CardHeader>
        <CardContent className={cn("space-y-4", isMobile && "px-2")}>
          {/* Wallet Status */}
          {nwc.activeConnection && (
            <Alert>
              <Wallet className="h-4 w-4" />
              <AlertDescription>
                <strong>Wallet Connected:</strong> Nostr Wallet Connect (NWC)
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="nwc">Nostr Wallet Connect String</Label>
            <Input
              id="nwc"
              placeholder="nostrwalletconnect://... or nostr+walletconnect://..."
              value={tempNwcString}
              onChange={(e) => setTempNwcString(e.target.value)}
              type="password"
            />
            <p className="text-sm text-muted-foreground">
              Connect your lightning wallet to enable seamless zapping. NWC takes priority over WebLN.
            </p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Get your NWC string from compatible wallets like Alby, coinos.io, or Cashu.me.
              This enables automatic zap payments without manual approval.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card className={cn(isMobile && "mx-0 rounded-none border-x-0")}>
        <CardHeader className={cn(isMobile && "px-4")}>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-orange-500" />
            <span>Zap Preferences</span>
          </CardTitle>
        </CardHeader>
        <CardContent className={cn("space-y-4", isMobile && "px-2")}>
          <div className="space-y-2">
            <Label htmlFor="zap-amount">Default Zap Amount (sats)</Label>
            <Input
              id="zap-amount"
              type="number"
              placeholder="21"
              value={tempZapAmount}
              onChange={(e) => setTempZapAmount(e.target.value)}
              min="1"
            />
            <p className="text-sm text-muted-foreground">
              This amount will be pre-filled when zapping posts
            </p>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Popular amounts:</strong></p>
            <div className="flex flex-wrap gap-2">
              {['21', '100', '500', '1000', '5000'].map(amount => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setTempZapAmount(amount)}
                  className="h-7 px-2 text-xs"
                >
                  {amount} sats
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex space-x-2">
        <Button
          onClick={handleSaveZapSettings}
          disabled={!hasChanges}
          className="flex-1"
        >
          Save Zap Settings
        </Button>
        {hasChanges && (
          <Button
            variant="outline"
            onClick={handleReset}
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}