import { useContext, useState } from 'react';
import { VideoFeedContext } from '@/contexts/VideoFeedContext';

/**
 * Hook that optionally uses VideoFeedContext if available,
 * otherwise provides local state for video playback management
 */
export function useOptionalVideoFeedContext() {
  const context = useContext(VideoFeedContext);
  
  // Local state for when context is not available
  const [localCurrentlyPlayingId, setLocalCurrentlyPlayingId] = useState<string | null>(null);
  const [localGlobalMuteState, setLocalGlobalMuteState] = useState(true);

  // If context is available, use it; otherwise use local state
  if (context) {
    return context;
  }

  return {
    currentlyPlayingId: localCurrentlyPlayingId,
    setCurrentlyPlayingId: setLocalCurrentlyPlayingId,
    globalMuteState: localGlobalMuteState,
    setGlobalMuteState: setLocalGlobalMuteState,
  };
}