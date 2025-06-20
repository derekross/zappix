import { createContext, useContext, useState, ReactNode } from 'react';

interface VideoFeedContextType {
  currentlyPlayingId: string | null;
  setCurrentlyPlayingId: (id: string | null) => void;
  globalMuteState: boolean;
  setGlobalMuteState: (muted: boolean) => void;
  isContextAvailable: boolean;
}

export const VideoFeedContext = createContext<VideoFeedContextType | undefined>(undefined);

export function VideoFeedProvider({ children }: { children: ReactNode }) {
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [globalMuteState, setGlobalMuteState] = useState(true); // Start muted by default

  return (
    <VideoFeedContext.Provider
      value={{
        currentlyPlayingId,
        setCurrentlyPlayingId,
        globalMuteState,
        setGlobalMuteState,
        isContextAvailable: true,
      }}
    >
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

export function useOptionalVideoFeedContext() {
  const context = useContext(VideoFeedContext);
  
  // If no context is available, return default values with no-op functions
  if (context === undefined) {
    return {
      currentlyPlayingId: null,
      setCurrentlyPlayingId: () => {},
      globalMuteState: true,
      setGlobalMuteState: () => {},
      isContextAvailable: false,
    };
  }
  
  return context;
}