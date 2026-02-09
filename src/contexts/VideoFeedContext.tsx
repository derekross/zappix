import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';

interface VideoFeedContextType {
  currentlyPlayingId: string | null;
  setCurrentlyPlayingId: (id: string | null) => void;
  globalMuteState: boolean;
  setGlobalMuteState: (muted: boolean) => void;
}

const VideoFeedContext = createContext<VideoFeedContextType | undefined>(undefined);

interface VideoFeedProviderProps {
  children: ReactNode;
}

export function VideoFeedProvider({ children }: VideoFeedProviderProps) {
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [globalMuteState, setGlobalMuteState] = useState(true);

  const value = useMemo<VideoFeedContextType>(() => ({
    currentlyPlayingId,
    setCurrentlyPlayingId,
    globalMuteState,
    setGlobalMuteState,
  }), [currentlyPlayingId, globalMuteState]);

  return (
    <VideoFeedContext.Provider value={value}>
      {children}
    </VideoFeedContext.Provider>
  );
}

export function useVideoFeedContext() {
  const context = useContext(VideoFeedContext);
  if (context === undefined) {
    throw new Error('useVideoFeedContext must be used within a VideoFeedProvider');
  }
  return context;
}

// Also export the context for optional usage
export { VideoFeedContext };