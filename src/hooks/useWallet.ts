import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNWC } from '@/hooks/useNWCContext';
import type { WebLNProvider } from 'webln';
import { requestProvider } from 'webln';

export interface WalletStatus {
  hasWebLN: boolean;
  hasNWC: boolean;
  webln: WebLNProvider | null;
  activeNWC: ReturnType<typeof useNWC>['getActiveConnection'] extends () => infer T ? T : null;
  isDetecting: boolean;
  preferredMethod: 'nwc' | 'webln' | 'manual';
}

// WebLN detection is shared across the whole session: useWallet is mounted by
// every ZapButton in the feed, so detecting per hook instance would re-run
// requestProvider() for every post scrolled into view.
let weblnDetection: Promise<WebLNProvider | null> | null = null;

function detectWebLNProvider(force = false): Promise<WebLNProvider | null> {
  if (!weblnDetection || force) {
    weblnDetection = requestProvider().catch((error: unknown) => {
      // Only log the error if it's not the common "no provider" error
      if (error instanceof Error && !error.message.includes('no WebLN provider')) {
        console.warn('WebLN detection error:', error);
      }
      return null;
    });
  }
  return weblnDetection;
}

export function useWallet() {
  const [webln, setWebln] = useState<WebLNProvider | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [hasAttemptedDetection, setHasAttemptedDetection] = useState(false);
  const { connections, getActiveConnection } = useNWC();

  // Get the active connection directly - no memoization to avoid stale state
  const activeNWC = getActiveConnection();

  // Explicit re-detection (e.g. when the zap dialog opens) bypasses the cache
  // so an extension enabled mid-session can still be picked up
  const detectWebLN = useCallback(async () => {
    setIsDetecting(true);
    try {
      const provider = await detectWebLNProvider(true);
      setWebln(provider);
      return provider;
    } finally {
      setIsDetecting(false);
      setHasAttemptedDetection(true);
    }
  }, []);

  // Initial detection uses the shared, session-wide result
  useEffect(() => {
    let cancelled = false;
    detectWebLNProvider().then((provider) => {
      if (!cancelled) {
        setWebln(provider);
        setHasAttemptedDetection(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Test WebLN connection
  const testWebLN = useCallback(async (): Promise<boolean> => {
    if (!webln) return false;

    try {
      await webln.enable();
      return true;
    } catch (error) {
      console.error('WebLN test failed:', error);
      return false;
    }
  }, [webln]);

  // Calculate status values reactively
  const hasNWC = useMemo(() => {
    return connections.length > 0 && connections.some(c => c.isConnected);
  }, [connections]);

  // Determine preferred payment method
  const preferredMethod: WalletStatus['preferredMethod'] = activeNWC
    ? 'nwc'
    : webln
    ? 'webln'
    : 'manual';

  const status: WalletStatus = {
    hasWebLN: !!webln,
    hasNWC,
    webln,
    activeNWC,
    isDetecting,
    preferredMethod,
  };

  return {
    ...status,
    hasAttemptedDetection,
    detectWebLN,
    testWebLN,
  };
}