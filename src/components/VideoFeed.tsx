import { VideoFeedSimple } from "./VideoFeedSimple_backup";

interface VideoFeedProps {
  feedType: "global" | "following";
  hashtag?: string;
  location?: string;
  onHashtagClick?: (hashtag: string) => void;
  onLocationClick?: (location: string) => void;
}

export function VideoFeed({
  feedType,
  hashtag,
  location,
  onHashtagClick,
  onLocationClick,
}: VideoFeedProps) {
  return (
    <VideoFeedSimple
      feedType={feedType}
      hashtag={hashtag}
      location={location}
      onHashtagClick={onHashtagClick}
      onLocationClick={onLocationClick}
    />
  );
}