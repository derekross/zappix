import { createContext, useContext, useState, ReactNode } from 'react';

interface VideoFeedContextType {
  currentlyPlayingId: string | null;
  setCurrentlyPlayingId: (id: string | null) => void;
  globalMuteState: boolean;
  setGlobalMuteState: (muted: boolean) => void;
}

const VideoFeedContext = createContext<VideoFeedContextType | undefined>(undefined);

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